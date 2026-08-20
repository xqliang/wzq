// Package shop 提供外观商店：商品目录（权威定价）、拥有关系、购买与装备。
//
// 商品分三类槽位（slot）：board 棋盘皮肤 / frame 头像框 / effect 落子动效。
// 基础款价格为 0 且默认拥有（wood/gold/ripple 等）；其余需用金币或卷轴购买。
// 购买用事务 + 条件扣费（余额不足则 RowsAffected=0），保证并发下不会超扣/重复拥有。
package shop

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/wzq/gomoku/internal/store"
)

// Item 是一件外观商品。Preview 供前端渲染小样：board->主题id，frame->框id，effect->动效id。
type Item struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Slot     string `json:"slot"`     // board / frame / effect
	Price    int    `json:"price"`    // 0 表示基础款（默认拥有，不可购买）
	Currency string `json:"currency"` // coins / scrolls
	Preview  string `json:"preview"`
}

// Catalog 是权威商品目录（服务端定价，前端仅展示）。
var Catalog = []Item{
	// 棋盘皮肤
	{ID: "wood", Name: "木纹", Slot: "board", Price: 0, Currency: "coins", Preview: "wood"},
	{ID: "ink", Name: "黑白", Slot: "board", Price: 0, Currency: "coins", Preview: "ink"},
	{ID: "stone", Name: "石纹", Slot: "board", Price: 300, Currency: "coins", Preview: "stone"},
	{ID: "jade", Name: "玉石", Slot: "board", Price: 800, Currency: "coins", Preview: "jade"},
	{ID: "blue", Name: "青蓝", Slot: "board", Price: 1000, Currency: "coins", Preview: "blue"},
	{ID: "gold", Name: "流金岁月", Slot: "board", Price: 30, Currency: "scrolls", Preview: "gold"},
	// 头像框（默认「无」，描金环需购买）
	{ID: "none", Name: "无", Slot: "frame", Price: 0, Currency: "coins", Preview: "none"},
	{ID: "gold", Name: "描金环", Slot: "frame", Price: 500, Currency: "coins", Preview: "gold"},
	{ID: "bronze", Name: "古铜环", Slot: "frame", Price: 300, Currency: "coins", Preview: "bronze"},
	{ID: "jade", Name: "青玉环", Slot: "frame", Price: 800, Currency: "coins", Preview: "jade"},
	// 落子动效
	{ID: "ripple", Name: "水波", Slot: "effect", Price: 0, Currency: "coins", Preview: "ripple"},
	{ID: "none", Name: "无", Slot: "effect", Price: 0, Currency: "coins", Preview: "none"},
	{ID: "dust", Name: "尘屑", Slot: "effect", Price: 200, Currency: "coins", Preview: "dust"},
	{ID: "ink", Name: "墨韵", Slot: "effect", Price: 200, Currency: "coins", Preview: "ink"},
	{ID: "star", Name: "星芒", Slot: "effect", Price: 300, Currency: "coins", Preview: "star"},
	{ID: "flame", Name: "流焰", Slot: "effect", Price: 300, Currency: "coins", Preview: "flame"},
}

// 错误集合。
var (
	ErrNotFound     = errors.New("item not found")
	ErrOwned        = errors.New("already owned")
	ErrNotOwned     = errors.New("not owned")
	ErrInsufficient = errors.New("insufficient balance")
	ErrBadSlot      = errors.New("bad slot")
)

// find 按 slot+id 定位商品（同一 id 可能跨槽位重名，如 gold 既是棋盘也是框）。
func find(slot, id string) (Item, bool) {
	for _, it := range Catalog {
		if it.Slot == slot && it.ID == id {
			return it, true
		}
	}
	return Item{}, false
}

// itemKey 生成 user_item 的存储键（slot:id）。
// 拥有关系必须按「槽位+id」区分，否则 board 与 frame 同名(如均有 gold/jade)会串号——
// 买了描金环(frame:gold)会误判为已拥有流金岁月棋盘(board:gold)。
func itemKey(slot, id string) string { return slot + ":" + id }

// validSlot 校验槽位并返回对应的 user 表已装备列名（白名单，避免 SQL 注入）。
func equippedCol(slot string) (string, bool) {
	switch slot {
	case "board":
		return "equipped_board", true
	case "frame":
		return "equipped_frame", true
	case "effect":
		return "equipped_effect", true
	}
	return "", false
}

// Service 提供商店业务，依赖底层 store。
type Service struct{ s *store.Store }

// New 构造商店服务。
func New(s *store.Store) *Service { return &Service{s: s} }

// StateItem 是带拥有/装备标记的商品视图。
type StateItem struct {
	Item
	Owned    bool `json:"owned"`
	Equipped bool `json:"equipped"`
}

// State 是 GET /api/shop 的返回：余额、已装备、带标记的商品列表。
type State struct {
	Coins    int               `json:"coins"`
	Scrolls  int               `json:"scrolls"`
	Equipped map[string]string `json:"equipped"`
	Items    []StateItem       `json:"items"`
}

// owned 返回用户已购买的 item_id 集合（不含基础款）。
func (svc *Service) owned(uid int64) (map[string]bool, error) {
	rows, err := svc.s.DB.Query(`SELECT item_id FROM user_item WHERE uid=?`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	set := map[string]bool{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		set[id] = true
	}
	return set, rows.Err()
}

// equipped 读取用户三个槽位的已装备项。
func (svc *Service) equipped(uid int64) (map[string]string, error) {
	var board, frame, effect string
	err := svc.s.DB.QueryRow(
		`SELECT equipped_board, equipped_frame, equipped_effect FROM user WHERE id=?`, uid).
		Scan(&board, &frame, &effect)
	if err != nil {
		return nil, err
	}
	return map[string]string{"board": board, "frame": frame, "effect": effect}, nil
}

// State 汇总商店展示所需的一切。基础款（价格 0）视为默认拥有。
func (svc *Service) State(uid int64) (State, error) {
	var coins, scrolls int
	if err := svc.s.DB.QueryRow(`SELECT coins, scrolls FROM user WHERE id=?`, uid).Scan(&coins, &scrolls); err != nil {
		return State{}, err
	}
	own, err := svc.owned(uid)
	if err != nil {
		return State{}, err
	}
	eq, err := svc.equipped(uid)
	if err != nil {
		return State{}, err
	}
	items := make([]StateItem, 0, len(Catalog))
	for _, it := range Catalog {
		isOwned := it.Price == 0 || own[itemKey(it.Slot, it.ID)]
		items = append(items, StateItem{
			Item:     it,
			Owned:    isOwned,
			Equipped: eq[it.Slot] == it.ID,
		})
	}
	return State{Coins: coins, Scrolls: scrolls, Equipped: eq, Items: items}, nil
}

// Buy 购买一件商品（按 slot+id 定位，避免跨槽位同名歧义）。事务 + 条件扣费保证并发安全。
func (svc *Service) Buy(uid int64, slot, id string) error {
	it, ok := find(slot, id)
	if !ok {
		return ErrNotFound
	}
	if it.Price == 0 {
		return ErrOwned // 基础款默认拥有，无需购买
	}
	col := "coins"
	if it.Currency == "scrolls" {
		col = "scrolls"
	}
	tx, err := svc.s.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	key := itemKey(it.Slot, it.ID)
	// 已拥有则拒绝（避免重复扣费）。
	var n int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM user_item WHERE uid=? AND item_id=?`, uid, key).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return ErrOwned
	}
	// 条件扣费：余额不足则不更新任何行。
	res, err := tx.Exec(`UPDATE user SET `+col+`=`+col+`-? WHERE id=? AND `+col+`>=?`, it.Price, uid, it.Price)
	if err != nil {
		return err
	}
	if aff, _ := res.RowsAffected(); aff == 0 {
		return ErrInsufficient
	}
	if _, err := tx.Exec(`INSERT INTO user_item (uid, item_id, purchased_at) VALUES (?,?,?)`, uid, key, time.Now()); err != nil {
		return err
	}
	return tx.Commit()
}

// Equip 装备一件已拥有的商品到其槽位。基础款（价格 0）默认可装备。
func (svc *Service) Equip(uid int64, slot, id string) error {
	col, ok := equippedCol(slot)
	if !ok {
		return ErrBadSlot
	}
	it, ok := find(slot, id)
	if !ok {
		return ErrNotFound
	}
	if it.Price != 0 {
		var n int
		if err := svc.s.DB.QueryRow(`SELECT COUNT(*) FROM user_item WHERE uid=? AND item_id=?`, uid, itemKey(slot, id)).Scan(&n); err != nil {
			return err
		}
		if n == 0 {
			return ErrNotOwned
		}
	}
	_, err := svc.s.DB.Exec(`UPDATE user SET `+col+`=? WHERE id=?`, id, uid)
	return err
}

// validity 是购买类外观的有效期（7 天）。基础款（价格 0）永不过期。
const validity = 7 * 24 * time.Hour

// defaultSlot 是各槽位外观过期/失效后回退的基础款 id（与 Catalog 基础款一致）。
var defaultSlot = map[string]string{"board": "wood", "frame": "none", "effect": "ripple"}

// ExpiredItem 描述一件已过期（失效）的已装备外观，供前端弹窗提示。
type ExpiredItem struct {
	Slot string `json:"slot"` // board / frame / effect
	Name string `json:"name"` // 商品中文名
}

// parseDBTime 解析数据库写入的时间字符串，兼容 sqlite/mysql 的 DATETIME 格式与 RFC3339。
func parseDBTime(s string) (time.Time, error) {
	for _, layout := range []string{"2006-01-02 15:04:05", time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("bad time %q", s)
}

// expiredKeys 返回用户已购买且已超过有效期的 item 键集合（slot:id）。
// 只依据 user_item 里的购买记录判定：无购买记录的（基础款或旧数据）永不过期。
func (svc *Service) expiredKeys(uid int64) (map[string]bool, error) {
	rows, err := svc.s.DB.Query(`SELECT item_id, purchased_at FROM user_item WHERE uid=?`, uid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	now := time.Now()
	expired := map[string]bool{}
	for rows.Next() {
		var key string
		var pt sql.NullTime
		if err := rows.Scan(&key, &pt); err != nil {
			return nil, err
		}
		// 购买时间为空（极端旧数据）不判过期，避免误伤。
		if !pt.Valid || pt.Time.IsZero() {
			continue
		}
		if now.Sub(pt.Time) > validity {
			expired[key] = true
		}
	}
	return expired, rows.Err()
}

// ExpireEquipped 检查三个槽位当前装备的外观：若已超过有效期，则将其回退为基础款、
// 清除对应购买记录（视为失效，需重新购买），并返回失效项列表供前端弹窗提示。
// 该方法幂等：同一物品只会在越过 7 天那一刻被处理一次。
func (svc *Service) ExpireEquipped(uid int64) ([]ExpiredItem, error) {
	eq, err := svc.equipped(uid)
	if err != nil {
		return nil, err
	}
	tx, err := svc.s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	expired := []ExpiredItem{}
	for _, slot := range []string{"board", "frame", "effect"} {
		id := eq[slot]
		if id == "" || id == defaultSlot[slot] {
			continue // 未装备或已是基础款，无需处理
		}
		it, ok := find(slot, id)
		if !ok || it.Price == 0 {
			continue // 非法或基础款，永不过期
		}
		// 读取该件购买时间：无记录则不判过期。
		var pt sql.NullTime
		err := tx.QueryRow(`SELECT purchased_at FROM user_item WHERE uid=? AND item_id=?`, uid, itemKey(slot, id)).Scan(&pt)
		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return nil, err
		}
		if !pt.Valid || time.Since(pt.Time) <= validity {
			continue // 未过期
		}
		// 已过期：回退到基础款 + 删除购买记录。
		col, _ := equippedCol(slot)
		if _, err := tx.Exec(`UPDATE user SET `+col+`=? WHERE id=?`, defaultSlot[slot], uid); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(`DELETE FROM user_item WHERE uid=? AND item_id=?`, uid, itemKey(slot, id)); err != nil {
			return nil, err
		}
		expired = append(expired, ExpiredItem{Slot: slot, Name: it.Name})
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return expired, nil
}
