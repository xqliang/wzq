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

// TestSubmitAcceptedAnswer 校验 Submit 对「可接受首着」返回 correct=true，对非解返回 false。
func TestSubmitAcceptedAnswer(t *testing.T) {
	svc, _, uid := newSvc(t)
	l := Levels[0]
	ans := l.AcceptedAnswers()
	if len(ans) == 0 {
		t.Fatalf("level %s 无可接受首着", l.ID)
	}
	correct, err := svc.Submit(uid, l.ID, ans[0][0], ans[0][1])
	if err != nil {
		t.Fatal(err)
	}
	if !correct {
		t.Fatalf("提交可接受首着 %v 应为正解", ans[0])
	}
	// 找一个不在答案集合内的空点作为错误提交。
	wx, wy := -1, -1
	g := gridFromStones(l.Stones)
	for y := 0; y < size && wx < 0; y++ {
		for x := 0; x < size; x++ {
			if g[y][x] == "" && !contains(ans, x, y) {
				wx, wy = x, y
				break
			}
		}
	}
	wrong, err := svc.Submit(uid, l.ID, wx, wy)
	if err != nil {
		t.Fatal(err)
	}
	if wrong {
		t.Fatalf("提交非解 (%d,%d) 应为错误", wx, wy)
	}
}

// TestCompleteAwardsExp 校验 Complete 的通关结算：首次胜利按难度奖励经验、置 passed、
// 累加 attempts；再次胜利不重复奖励；失败仅累加 attempts、不奖励、不置 passed。
func TestCompleteAwardsExp(t *testing.T) {
	svc, users, uid := newSvc(t)
	l := Levels[0]
	before, err := users.Get(uid)
	if err != nil {
		t.Fatal(err)
	}
	// 首次胜利：+ (10 + 5*Difficulty)。
	if err := svc.Complete(uid, l.ID, true); err != nil {
		t.Fatal(err)
	}
	want := before.Exp + 10 + 5*l.Difficulty
	after, _ := users.Get(uid)
	if after.Exp != want {
		t.Fatalf("首次通关经验应为 %d，实际 %d", want, after.Exp)
	}
	// 列表应显示已通关、attempts>=1。
	passed, attempts := false, 0
	for _, m := range svc.List(uid) {
		if m.ID == l.ID {
			passed, attempts = m.Passed, m.Attempts
		}
	}
	if !passed {
		t.Fatal("首次胜利后应标记为已通关")
	}
	if attempts < 1 {
		t.Fatalf("attempts 应 >=1，实际 %d", attempts)
	}
	// 再次胜利：不重复奖励，attempts 再 +1。
	if err := svc.Complete(uid, l.ID, true); err != nil {
		t.Fatal(err)
	}
	again, _ := users.Get(uid)
	if again.Exp != want {
		t.Fatalf("重复通关不应再奖励经验：%d vs %d", again.Exp, want)
	}
	// 失败一次：attempts 再 +1，不奖励、不改变 passed。
	if err := svc.Complete(uid, l.ID, false); err != nil {
		t.Fatal(err)
	}
	lose, _ := users.Get(uid)
	if lose.Exp != want {
		t.Fatalf("失败不应奖励经验：%d vs %d", lose.Exp, want)
	}
	for _, m := range svc.List(uid) {
		if m.ID == l.ID {
			if !m.Passed {
				t.Fatal("已通关状态不应被失败覆盖")
			}
			if m.Attempts < 3 {
				t.Fatalf("三次结算后 attempts 应 >=3，实际 %d", m.Attempts)
			}
		}
	}
}

// TestProgressAndExp 校验 Submit 首次正解奖励 +10 且不重复奖励（Submit 保留用于提示/答案流）。
func TestProgressAndExp(t *testing.T) {
	svc, users, uid := newSvc(t)
	l := Levels[0]
	ans := l.AcceptedAnswers()
	if len(ans) == 0 {
		t.Fatalf("level %s 无可接受首着", l.ID)
	}
	before, err := users.Get(uid)
	if err != nil {
		t.Fatal(err)
	}
	correct, err := svc.Submit(uid, l.ID, ans[0][0], ans[0][1])
	if err != nil || !correct {
		t.Fatalf("首次提交应为正解: correct=%v err=%v", correct, err)
	}
	found := false
	for _, m := range svc.List(uid) {
		if m.ID == l.ID {
			found = true
			if !m.Passed {
				t.Fatalf("%s 应已通关", l.ID)
			}
			if m.Attempts < 1 {
				t.Fatalf("attempts 应 >=1，实际 %d", m.Attempts)
			}
		}
	}
	if !found {
		t.Fatalf("%s 不在列表中", l.ID)
	}
	after, _ := users.Get(uid)
	if after.Exp != before.Exp+10 {
		t.Fatalf("经验应 +10：before=%d after=%d", before.Exp, after.Exp)
	}
	// 再次正解不应重复奖励。
	if _, err := svc.Submit(uid, l.ID, ans[0][0], ans[0][1]); err != nil {
		t.Fatal(err)
	}
	again, _ := users.Get(uid)
	if again.Exp != after.Exp {
		t.Fatalf("重复通关不应再奖励经验：%d vs %d", again.Exp, after.Exp)
	}
}

// TestHintCounts 校验 Hint 返回一个属于可接受答案集合的落子。
func TestHintCounts(t *testing.T) {
	svc, _, uid := newSvc(t)
	id := Levels[0].ID
	cell, err := svc.Hint(uid, id)
	if err != nil {
		t.Fatal(err)
	}
	if cell == nil {
		t.Fatal("hint 应返回非空落子")
	}
	l, _ := findLevel(id)
	if !contains(l.AcceptedAnswers(), cell[0], cell[1]) {
		t.Fatalf("hint 落子 %v 不在可接受答案集合内", *cell)
	}
}

// TestHintRandomizes 校验有多解的关卡,多次 Hint 不应总返回同一个点(随机化)。
// 取多解的第 3-4 关(4 个首着),连取 40 次,应出现至少 2 个不同落子。
func TestHintRandomizes(t *testing.T) {
	svc, _, uid := newSvc(t)
	id := "3-4"
	l, ok := findLevel(id)
	if !ok {
		t.Fatalf("level %s 不存在", id)
	}
	if n := len(l.AcceptedAnswers()); n < 2 {
		t.Fatalf("%s 仅 %d 个可接受首着,不足以测随机", id, n)
	}
	seen := map[[2]int]bool{}
	for i := 0; i < 40; i++ {
		cell, err := svc.Hint(uid, id)
		if err != nil || cell == nil {
			t.Fatalf("hint 失败: %v %v", cell, err)
		}
		seen[[2]int{cell[0], cell[1]}] = true
	}
	if len(seen) < 2 {
		t.Fatalf("40 次 Hint 只出现 1 个落子,随机化失效: %v", seen)
	}
}
