// Package shop 提供外观商店：商品目录（权威定价）、拥有关系、购买与装备。
//
// 商品分三类槽位（slot）：board 棋盘皮肤 / frame 头像框 / effect 落子动效。
// 基础款价格为 0 且默认拥有（wood/gold/ripple 等）；其余需用金币或卷轴购买。
// 购买用事务 + 条件扣费（余额不足则 RowsAffected=0），保证并发下不会超扣/重复拥有。
package shop

import (
	"errors"

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
	// 头像框
	{ID: "gold", Name: "描金环", Slot: "frame", Price: 0, Currency: "coins", Preview: "gold"},
	{ID: "bronze", Name: "古铜环", Slot: "frame", Price: 300, Currency: "coins", Preview: "bronze"},
	{ID: "jade", Name: "青玉环", Slot: "frame", Price: 800, Currency: "coins", Preview: "jade"},
	// 落子动效
	{ID: "ripple", Name: "水波", Slot: "effect", Price: 0, Currency: "coins", Preview: "ripple"},
	{ID: "dust", Name: "尘屑", Slot: "effect", Price: 200, Currency: "coins", Preview: "dust"},
	{ID: "none", Name: "无", Slot: "effect", Price: 0, Currency: "coins", Preview: "none"},
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
		isOwned := it.Price == 0 || own[it.ID]
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
	// 已拥有则拒绝（避免重复扣费）。
	var n int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM user_item WHERE uid=? AND item_id=?`, uid, it.ID).Scan(&n); err != nil {
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
	if _, err := tx.Exec(`INSERT INTO user_item (uid, item_id) VALUES (?,?)`, uid, it.ID); err != nil {
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
		if err := svc.s.DB.QueryRow(`SELECT COUNT(*) FROM user_item WHERE uid=? AND item_id=?`, uid, id).Scan(&n); err != nil {
			return err
		}
		if n == 0 {
			return ErrNotOwned
		}
	}
	_, err := svc.s.DB.Exec(`UPDATE user SET `+col+`=? WHERE id=?`, id, uid)
	return err
}
