// Package daily 提供每日签到与幸运转盘（阶段D）。
// 奖励发放（金币/卷轴/棋盘皮肤）与转盘扣费均在事务内完成，保证并发安全与按天幂等。
package daily

import (
	"database/sql"
	"errors"
	"math/rand"
	"time"

	"github.com/wzq/gomoku/internal/store"
)

var (
	ErrClaimed      = errors.New("already claimed today") // 今日已签到
	ErrInsufficient = errors.New("insufficient coins")    // 金币不足以抽奖
)

// Reward 是一份奖励：kind=coins/scrolls/item；item 时 ItemID 为棋盘等皮肤 id。
type Reward struct {
	Kind   string `json:"kind"`
	Amount int    `json:"amount"`
	ItemID string `json:"itemId,omitempty"`
	Label  string `json:"label"`
}

// checkinRewards 为 7 天签到奖励循环（对齐竞品：金币/特级棋盘/卷轴/大奖）。
var checkinRewards = []Reward{
	{Kind: "coins", Amount: 100, Label: "金币×100"},
	{Kind: "item", ItemID: "jade", Amount: 1, Label: "特级棋盘"},
	{Kind: "scrolls", Amount: 10, Label: "卷轴×10"},
	{Kind: "coins", Amount: 200, Label: "金币×200"},
	{Kind: "scrolls", Amount: 20, Label: "卷轴×20"},
	{Kind: "coins", Amount: 300, Label: "金币×300"},
	{Kind: "coins", Amount: 500, Label: "神秘大奖"},
}

// 幸运转盘奖池与权重（sum=100），以及每次消耗金币。
var wheelPrizes = []Reward{
	{Kind: "coins", Amount: 50, Label: "金币×50"},
	{Kind: "coins", Amount: 80, Label: "金币×80"},
	{Kind: "coins", Amount: 20, Label: "金币×20"},
	{Kind: "coins", Amount: 100, Label: "金币×100"},
	{Kind: "scrolls", Amount: 5, Label: "卷轴×5"},
	{Kind: "coins", Amount: 300, Label: "金币×300"},
	{Kind: "scrolls", Amount: 2, Label: "卷轴×2"},
	{Kind: "coins", Amount: 500, Label: "金币×500"},
}
var wheelWeights = []int{22, 18, 20, 14, 8, 6, 8, 4}

// WheelCost 是单次抽奖的金币消耗。
const WheelCost = 100

// Service 提供签到/转盘业务，依赖底层 store。
type Service struct{ s *store.Store }

// New 构造服务。
func New(s *store.Store) *Service { return &Service{s: s} }

func today() string { return time.Now().Format("2006-01-02") }

// CheckinState 是签到面板状态。
type CheckinState struct {
	Rewards  []Reward `json:"rewards"`
	DayIndex int      `json:"dayIndex"` // 今日应领的下标(0-6)
	Claimed  bool     `json:"claimed"`  // 今日是否已领
	Streak   int      `json:"streak"`   // 累计签到天数
}

// CheckinState 读取当前用户签到状态（无记录视为全新）。
func (svc *Service) CheckinState(uid int64) CheckinState {
	var lastDay string
	var streak int
	if err := svc.s.DB.QueryRow(`SELECT last_day, streak FROM checkin WHERE uid=?`, uid).Scan(&lastDay, &streak); err != nil {
		lastDay, streak = "", 0
	}
	return CheckinState{Rewards: checkinRewards, DayIndex: streak % 7, Claimed: lastDay == today(), Streak: streak}
}

// Claim 领取今日签到奖励（double=看广告双倍）。同一天重复领取返回 ErrClaimed。
func (svc *Service) Claim(uid int64, double bool) (Reward, error) {
	tx, err := svc.s.DB.Begin()
	if err != nil {
		return Reward{}, err
	}
	defer tx.Rollback()
	var lastDay string
	var streak int
	if err := tx.QueryRow(`SELECT last_day, streak FROM checkin WHERE uid=?`+svc.s.LockClause(), uid).Scan(&lastDay, &streak); err != nil {
		// 无记录：建初始行。
		lastDay, streak = "", 0
		if _, err := tx.Exec(`INSERT INTO checkin (uid, last_day, streak) VALUES (?,?,0)`, uid, ""); err != nil {
			return Reward{}, err
		}
	}
	if lastDay == today() {
		return Reward{}, ErrClaimed
	}
	r := checkinRewards[streak%7]
	amt := r.Amount
	if double {
		amt *= 2
	}
	if err := grant(tx, uid, r.Kind, amt, r.ItemID); err != nil {
		return Reward{}, err
	}
	if _, err := tx.Exec(`UPDATE checkin SET last_day=?, streak=? WHERE uid=?`, today(), streak+1, uid); err != nil {
		return Reward{}, err
	}
	if err := tx.Commit(); err != nil {
		return Reward{}, err
	}
	out := r
	out.Amount = amt
	return out, nil
}

// Prizes 返回转盘奖池（供前端渲染扇区）。
func (svc *Service) Prizes() []Reward { return wheelPrizes }

// SpinResult 是一次抽奖结果：命中扇区下标、奖励、以及最新余额。
type SpinResult struct {
	Index   int    `json:"index"`
	Prize   Reward `json:"prize"`
	Coins   int    `json:"coins"`
	Scrolls int    `json:"scrolls"`
}

// Spin 抽奖：先条件扣费（金币不足返回 ErrInsufficient），再按权重发奖。事务保证原子。
func (svc *Service) Spin(uid int64) (SpinResult, error) {
	tx, err := svc.s.DB.Begin()
	if err != nil {
		return SpinResult{}, err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`UPDATE user SET coins = coins - ? WHERE id=? AND coins >= ?`, WheelCost, uid, WheelCost)
	if err != nil {
		return SpinResult{}, err
	}
	if aff, _ := res.RowsAffected(); aff == 0 {
		return SpinResult{}, ErrInsufficient
	}
	idx := weightedPick(wheelWeights)
	p := wheelPrizes[idx]
	if err := grant(tx, uid, p.Kind, p.Amount, ""); err != nil {
		return SpinResult{}, err
	}
	var coins, scrolls int
	if err := tx.QueryRow(`SELECT coins, scrolls FROM user WHERE id=?`, uid).Scan(&coins, &scrolls); err != nil {
		return SpinResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return SpinResult{}, err
	}
	return SpinResult{Index: idx, Prize: p, Coins: coins, Scrolls: scrolls}, nil
}

// grant 在事务内发放奖励：金币/卷轴累加；item 幂等授予棋盘等皮肤。
func grant(tx *sql.Tx, uid int64, kind string, amount int, itemID string) error {
	switch kind {
	case "coins":
		_, err := tx.Exec(`UPDATE user SET coins = coins + ? WHERE id=?`, amount, uid)
		return err
	case "scrolls":
		_, err := tx.Exec(`UPDATE user SET scrolls = scrolls + ? WHERE id=?`, amount, uid)
		return err
	case "item":
		var n int
		if err := tx.QueryRow(`SELECT COUNT(*) FROM user_item WHERE uid=? AND item_id=?`, uid, itemID).Scan(&n); err != nil {
			return err
		}
		if n == 0 {
			_, err := tx.Exec(`INSERT INTO user_item (uid, item_id) VALUES (?,?)`, uid, itemID)
			return err
		}
	}
	return nil
}

// weightedPick 按权重随机返回下标。
func weightedPick(w []int) int {
	sum := 0
	for _, x := range w {
		sum += x
	}
	r := rand.Intn(sum)
	for i, x := range w {
		if r < x {
			return i
		}
		r -= x
	}
	return len(w) - 1
}
