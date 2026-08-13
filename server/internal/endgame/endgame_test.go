package endgame

import (
	"testing"

	"github.com/wzq/gomoku/internal/store"
	"github.com/wzq/gomoku/internal/user"
)

// newSvc 构造一个基于内存 sqlite 的残局服务用于测试。
func newSvc(t *testing.T) (*Service, *user.Service, int64) {
	t.Helper()
	s, err := store.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	users := user.New(s)
	u, err := users.CreateGuest()
	if err != nil {
		t.Fatal(err)
	}
	return New(s, users), users, u.ID
}

// contains 判断答案集合是否包含指定坐标。
func contains(ans [][2]int, x, y int) bool {
	for _, a := range ans {
		if a[0] == x && a[1] == y {
			return true
		}
	}
	return false
}

func TestWin1Accepts(t *testing.T) {
	svc, _, uid := newSvc(t)
	l, ok := findLevel("1-1")
	if !ok {
		t.Fatal("level 1-1 not found")
	}
	ans := l.AcceptedAnswers()
	if !contains(ans, 2, 7) || !contains(ans, 7, 7) {
		t.Fatalf("1-1 answers should contain [2,7] and [7,7], got %v", ans)
	}
	correct, err := svc.Submit(uid, "1-1", 7, 7)
	if err != nil {
		t.Fatal(err)
	}
	if !correct {
		t.Fatal("submit (7,7) should be correct")
	}
	wrong, err := svc.Submit(uid, "1-1", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if wrong {
		t.Fatal("submit (0,0) should be wrong")
	}
}

func TestMate2OpenThree(t *testing.T) {
	svc, _, uid := newSvc(t)
	l, ok := findLevel("2-1")
	if !ok {
		t.Fatal("level 2-1 not found")
	}
	if l.MinSteps() != 2 {
		t.Fatalf("2-1 should be mate in 2, got %d", l.MinSteps())
	}
	ans := l.AcceptedAnswers()
	// 活三 (6,7)(7,7)(8,7)：成活四的两点 (5,7)/(9,7) 均可导向必胜。
	if !contains(ans, 5, 7) || !contains(ans, 9, 7) {
		t.Fatalf("2-1 answers should contain [5,7] and [9,7], got %v", ans)
	}
	correct, err := svc.Submit(uid, "2-1", 5, 7)
	if err != nil {
		t.Fatal(err)
	}
	if !correct {
		t.Fatal("submit (5,7) should be correct")
	}
	wrong, err := svc.Submit(uid, "2-1", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if wrong {
		t.Fatal("submit (0,0) should be wrong")
	}
}

func TestJumpFour(t *testing.T) {
	svc, _, uid := newSvc(t)
	l, ok := findLevel("3-1")
	if !ok {
		t.Fatal("level 3-1 not found")
	}
	ans := l.AcceptedAnswers()
	if !contains(ans, 7, 7) {
		t.Fatalf("3-1 answers should contain [7,7], got %v", ans)
	}
	correct, err := svc.Submit(uid, "3-1", 7, 7)
	if err != nil {
		t.Fatal(err)
	}
	if !correct {
		t.Fatal("submit (7,7) should be correct")
	}
}

func TestProgressAndExp(t *testing.T) {
	svc, users, uid := newSvc(t)
	before, err := users.Get(uid)
	if err != nil {
		t.Fatal(err)
	}
	correct, err := svc.Submit(uid, "1-1", 7, 7)
	if err != nil || !correct {
		t.Fatalf("first submit correct: correct=%v err=%v", correct, err)
	}
	// 列表应显示已通关且尝试次数 >=1。
	found := false
	for _, m := range svc.List(uid) {
		if m.ID == "1-1" {
			found = true
			if !m.Passed {
				t.Fatal("1-1 should be passed")
			}
			if m.Attempts < 1 {
				t.Fatalf("attempts should be >=1, got %d", m.Attempts)
			}
		}
	}
	if !found {
		t.Fatal("1-1 not in list")
	}
	after, _ := users.Get(uid)
	if after.Exp != before.Exp+10 {
		t.Fatalf("exp should increase by 10: before=%d after=%d", before.Exp, after.Exp)
	}
	// 再次通关不应重复奖励经验。
	if _, err := svc.Submit(uid, "1-1", 7, 7); err != nil {
		t.Fatal(err)
	}
	again, _ := users.Get(uid)
	if again.Exp != after.Exp {
		t.Fatalf("second pass should not award exp again: %d vs %d", again.Exp, after.Exp)
	}
}

func TestHintCounts(t *testing.T) {
	svc, _, uid := newSvc(t)
	cell, err := svc.Hint(uid, "1-1")
	if err != nil {
		t.Fatal(err)
	}
	if cell == nil {
		t.Fatal("hint should return a non-nil cell")
	}
	l, _ := findLevel("1-1")
	if !contains(l.AcceptedAnswers(), cell[0], cell[1]) {
		t.Fatalf("hint cell %v not in accepted answers", *cell)
	}
}
