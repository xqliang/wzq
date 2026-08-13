package user

import (
	"testing"

	"github.com/wzq/gomoku/internal/store"
)

func newSvc(t *testing.T) *Service {
	s, err := store.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	return New(s)
}

func TestCreateGuestAndGet(t *testing.T) {
	svc := newSvc(t)
	u, err := svc.CreateGuest()
	if err != nil {
		t.Fatal(err)
	}
	if u.Nickname == "" || u.Level != 1 {
		t.Fatalf("bad guest: %+v", u)
	}
	got, err := svc.Get(u.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != u.ID {
		t.Fatal("get mismatch")
	}
}

func TestLevelFromExp(t *testing.T) {
	if LevelForExp(0) != 1 {
		t.Fatal("0 exp -> level 1")
	}
	if LevelForExp(100000) != 5 {
		t.Fatal("huge exp -> level 5")
	}
	if LevelForExp(120) <= 1 {
		t.Fatal("120 exp should be > level 1")
	}
}

func TestAddExpUpdatesLevel(t *testing.T) {
	svc := newSvc(t)
	u, _ := svc.CreateGuest()
	if err := svc.AddExp(u.ID, 200); err != nil {
		t.Fatal(err)
	}
	got, _ := svc.Get(u.ID)
	if got.Exp != 200 || got.Level < 2 {
		t.Fatalf("exp/level not updated: %+v", got)
	}
}
