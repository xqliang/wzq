package daily

import (
	"fmt"
	"path/filepath"
	"sync/atomic"
	"testing"

	"github.com/wzq/gomoku/internal/store"
)

var seq int64

func newStore(t *testing.T) *store.Store {
	t.Helper()
	s, err := store.Open("sqlite", filepath.Join(t.TempDir(), "daily.db"))
	if err != nil {
		t.Fatal(err)
	}
	s.DB.SetMaxOpenConns(1)
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	return s
}

func mkUser(t *testing.T, s *store.Store, coins int) int64 {
	t.Helper()
	gid := fmt.Sprintf("g%d", atomic.AddInt64(&seq, 1))
	res, err := s.DB.Exec(`INSERT INTO user (guest_id, nickname, avatar, coins) VALUES (?,?,?,?)`, gid, "测试", "avatar_01", coins)
	if err != nil {
		t.Fatal(err)
	}
	id, _ := res.LastInsertId()
	return id
}

func bal(t *testing.T, s *store.Store, uid int64) (int, int) {
	t.Helper()
	var c, sc int
	if err := s.DB.QueryRow(`SELECT coins, scrolls FROM user WHERE id=?`, uid).Scan(&c, &sc); err != nil {
		t.Fatal(err)
	}
	return c, sc
}

func TestCheckinClaimOncePerDay(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	uid := mkUser(t, s, 0)

	st := svc.CheckinState(uid)
	if st.Claimed || st.DayIndex != 0 {
		t.Fatalf("fresh state wrong: %+v", st)
	}
	r, err := svc.Claim(uid, false)
	if err != nil {
		t.Fatalf("claim: %v", err)
	}
	if r.Kind != "coins" || r.Amount != 100 { // 第一天 金币×100
		t.Fatalf("day1 reward = %+v want coins/100", r)
	}
	if c, _ := bal(t, s, uid); c != 100 {
		t.Fatalf("coins after claim = %d want 100", c)
	}
	if st := svc.CheckinState(uid); !st.Claimed || st.Streak != 1 {
		t.Fatalf("after claim state wrong: %+v", st)
	}
	// 同日重复领取被拒。
	if _, err := svc.Claim(uid, false); err != ErrClaimed {
		t.Fatalf("re-claim same day: got %v want ErrClaimed", err)
	}
}

func TestCheckinDouble(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	uid := mkUser(t, s, 0)
	r, err := svc.Claim(uid, true) // 双倍
	if err != nil {
		t.Fatal(err)
	}
	if r.Amount != 200 { // 100 * 2
		t.Fatalf("double day1 amount = %d want 200", r.Amount)
	}
	if c, _ := bal(t, s, uid); c != 200 {
		t.Fatalf("coins = %d want 200", c)
	}
}

func TestWheelSpinDeductsAndGrants(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	uid := mkUser(t, s, WheelCost) // 恰好够一次

	out, err := svc.Spin(uid)
	if err != nil {
		t.Fatalf("spin: %v", err)
	}
	if out.Index < 0 || out.Index >= len(wheelPrizes) {
		t.Fatalf("index out of range: %d", out.Index)
	}
	// 再抽一次应因金币不足失败（余额已扣光，除非中了金币奖）。
	c, _ := bal(t, s, uid)
	if c < WheelCost {
		if _, err := svc.Spin(uid); err != ErrInsufficient {
			t.Fatalf("spin with %d coins: got %v want ErrInsufficient", c, err)
		}
	}
}

func TestWheelInsufficient(t *testing.T) {
	s := newStore(t)
	svc := New(s)
	uid := mkUser(t, s, WheelCost-1)
	if _, err := svc.Spin(uid); err != ErrInsufficient {
		t.Fatalf("got %v want ErrInsufficient", err)
	}
	if c, _ := bal(t, s, uid); c != WheelCost-1 {
		t.Fatalf("coins changed on failed spin: %d", c)
	}
}
