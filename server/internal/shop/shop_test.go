package shop

import (
	"fmt"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/wzq/gomoku/internal/store"
)

var guestSeq int64

// newStore 打开一个临时文件 sqlite（连接数限 1，串行化以规避并发写锁，同时验证事务正确性）。
func newStore(t *testing.T) *store.Store {
	t.Helper()
	s, err := store.Open("sqlite", filepath.Join(t.TempDir(), "shop.db"))
	if err != nil {
		t.Fatal(err)
	}
	s.DB.SetMaxOpenConns(1)
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	return s
}

// mkUser 插入一名用户并返回 uid（equipped_* 走列默认值）。
func mkUser(t *testing.T, s *store.Store, coins int) int64 {
	t.Helper()
	gid := fmt.Sprintf("g%d", atomic.AddInt64(&guestSeq, 1))
	res, err := s.DB.Exec(`INSERT INTO user (guest_id, nickname, avatar, coins) VALUES (?,?,?,?)`, gid, "测试", "avatar_01", coins)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := res.LastInsertId()
	return id
}

func coinsOf(t *testing.T, s *store.Store, uid int64) int {
	t.Helper()
	var c int
	if err := s.DB.QueryRow(`SELECT coins FROM user WHERE id=?`, uid).Scan(&c); err != nil {
		t.Fatal(err)
	}
	return c
}

func TestBuyEquipFlow(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	uid := mkUser(t, s, 0)

	// 余额不足。
	if err := svc.Buy(uid, "board", "blue"); err != ErrInsufficient {
		t.Fatalf("buy with 0 coins: got %v want ErrInsufficient", err)
	}
	// 充值后购买成功并扣费。
	s.DB.Exec(`UPDATE user SET coins=2000 WHERE id=?`, uid)
	if err := svc.Buy(uid, "board", "blue"); err != nil {
		t.Fatalf("buy blue: %v", err)
	}
	if c := coinsOf(t, s, uid); c != 1000 {
		t.Fatalf("coins after buy = %d want 1000", c)
	}
	// 重复购买被拒。
	if err := svc.Buy(uid, "board", "blue"); err != ErrOwned {
		t.Fatalf("re-buy: got %v want ErrOwned", err)
	}
	// 基础款不可购买。
	if err := svc.Buy(uid, "board", "wood"); err != ErrOwned {
		t.Fatalf("buy free item: got %v want ErrOwned", err)
	}
	// 不存在的商品。
	if err := svc.Buy(uid, "board", "nope"); err != ErrNotFound {
		t.Fatalf("buy missing: got %v want ErrNotFound", err)
	}
	// 装备已购买的 blue。
	if err := svc.Equip(uid, "board", "blue"); err != nil {
		t.Fatalf("equip blue: %v", err)
	}
	st, err := svc.State(uid)
	if err != nil {
		t.Fatal(err)
	}
	if st.Equipped["board"] != "blue" {
		t.Fatalf("equipped board = %s want blue", st.Equipped["board"])
	}
	// 未拥有不可装备。
	if err := svc.Equip(uid, "board", "jade"); err != ErrNotOwned {
		t.Fatalf("equip unowned: got %v want ErrNotOwned", err)
	}
	// 基础款默认可装备。
	if err := svc.Equip(uid, "board", "ink"); err != nil {
		t.Fatalf("equip free ink: %v", err)
	}
	// 非法槽位。
	if err := svc.Equip(uid, "bogus", "x"); err != ErrBadSlot {
		t.Fatalf("equip bad slot: got %v want ErrBadSlot", err)
	}
}

func TestStateFreshUser(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	uid := mkUser(t, s, 500)
	st, err := svc.State(uid)
	if err != nil {
		t.Fatal(err)
	}
	if st.Coins != 500 {
		t.Fatalf("coins=%d want 500", st.Coins)
	}
	if st.Equipped["board"] != "wood" || st.Equipped["frame"] != "gold" || st.Equipped["effect"] != "ripple" {
		t.Fatalf("default equipped wrong: %+v", st.Equipped)
	}
	var wood, blue StateItem
	for _, it := range st.Items {
		if it.Slot == "board" && it.ID == "wood" {
			wood = it
		}
		if it.Slot == "board" && it.ID == "blue" {
			blue = it
		}
	}
	if !wood.Owned || !wood.Equipped {
		t.Fatalf("wood should be owned+equipped: %+v", wood)
	}
	if blue.Owned {
		t.Fatalf("blue should not be owned for fresh user")
	}
}

// TestBuyConcurrent 并发购买同一件商品：只应成功一次、只扣一次费。
func TestBuyConcurrent(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	uid := mkUser(t, s, 1000) // 恰好够买一次 blue(1000)

	const N = 20
	var success int64
	var wg sync.WaitGroup
	for i := 0; i < N; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := svc.Buy(uid, "board", "blue"); err == nil {
				atomic.AddInt64(&success, 1)
			}
		}()
	}
	wg.Wait()

	if success != 1 {
		t.Fatalf("concurrent buys succeeded %d times want exactly 1", success)
	}
	if c := coinsOf(t, s, uid); c != 0 {
		t.Fatalf("coins after concurrent buy = %d want 0 (charged once)", c)
	}
	// 恰好拥有一条 blue 记录（存储键为 slot:id）。
	var n int
	s.DB.QueryRow(`SELECT COUNT(*) FROM user_item WHERE uid=? AND item_id='board:blue'`, uid).Scan(&n)
	if n != 1 {
		t.Fatalf("owned blue rows=%d want 1", n)
	}
}
