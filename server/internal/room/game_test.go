package room

import "testing"

func TestGameFlow(t *testing.T) {
	g := NewGame(1, 2)
	if g.Turn() != 1 {
		t.Fatal("black moves first")
	}
	if _, err := g.Move(2, 7, 7); err == nil {
		t.Fatal("white should not move on black's turn")
	}
	if _, err := g.Move(1, 7, 7); err != nil {
		t.Fatal(err)
	}
	if g.Turn() != 2 {
		t.Fatal("turn should switch to white")
	}
}

func TestGameWin(t *testing.T) {
	g := NewGame(1, 2)
	seq := [][3]int{{1, 3, 7}, {2, 3, 8}, {1, 4, 7}, {2, 4, 8}, {1, 5, 7}, {2, 5, 8}, {1, 6, 7}, {2, 6, 8}}
	for _, m := range seq {
		if _, err := g.Move(int64(m[0]), m[1], m[2]); err != nil {
			t.Fatal(err)
		}
	}
	res, err := g.Move(1, 7, 7)
	if err != nil {
		t.Fatal(err)
	}
	if res == nil || res.Winner != 1 || res.Reason != "five" {
		t.Fatalf("expected black win by five, got %+v", res)
	}
}

func TestUndoNeedsBothAgree(t *testing.T) {
	g := NewGame(1, 2)
	g.Move(1, 7, 7)
	if !g.RequestUndo(2, 1) {
		t.Fatal("undo request should be allowed")
	}
	agreed, steps, requester := g.ReplyUndo(true)
	if !agreed || steps != 1 || requester != 2 {
		t.Fatalf("agreed undo wrong: agreed=%v steps=%d requester=%d", agreed, steps, requester)
	}
	if g.MovesCount() != 0 {
		t.Fatalf("board should revert, moves=%d", g.MovesCount())
	}
}

func TestUndoStepsAndTurn(t *testing.T) {
	g := NewGame(1, 2) // 1=黑 2=白
	g.Move(1, 0, 0)    // 黑
	g.Move(2, 1, 0)    // 白 -> 轮到黑(1)
	// 黑请求悔 2 步（撤白+己方黑），撤后剩 0 手，轮回黑(先手)。
	if !g.RequestUndo(1, 2) {
		t.Fatal("undo 2 steps should be allowed")
	}
	agreed, steps, _ := g.ReplyUndo(true)
	if !agreed || steps != 2 {
		t.Fatalf("undo 2: agreed=%v steps=%d", agreed, steps)
	}
	if g.MovesCount() != 0 || g.Turn() != 1 {
		t.Fatalf("after undo2 moves=%d turn=%d want 0/1(black)", g.MovesCount(), g.Turn())
	}
}

func TestUndoCapPerPlayer(t *testing.T) {
	g := NewGame(1, 2)
	for i := 0; i < 4; i++ { // 造 8 手历史（按当前轮次落子，保证合法）。
		g.Move(g.Turn(), i, 0)
		g.Move(g.Turn(), i, 1)
	}
	ok := 0
	for i := 0; i < 4; i++ {
		if g.RequestUndo(1, 1) {
			ok++
			g.ReplyUndo(true)
		}
	}
	if ok != 3 || g.UndoUsed(1) != 3 {
		t.Fatalf("undo allowed %d times (used=%d), want cap 3", ok, g.UndoUsed(1))
	}
}

func TestResign(t *testing.T) {
	g := NewGame(1, 2)
	res := g.Resign(1)
	if res.Winner != 2 || res.Reason != "resign" {
		t.Fatalf("resign wrong: %+v", res)
	}
}
