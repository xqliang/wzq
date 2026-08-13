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
	if !g.RequestUndo(2) {
		t.Fatal("undo request should be allowed")
	}
	if !g.ReplyUndo(true) {
		t.Fatal("agreed undo should succeed")
	}
	if g.MovesCount() != 0 {
		t.Fatalf("board should revert, moves=%d", g.MovesCount())
	}
}

func TestUndoCapPerPlayer(t *testing.T) {
	g := NewGame(1, 2)
	for i := 0; i < 3; i++ {
		g.Move(1, i, 0)
		g.Move(2, i, 1)
		g.RequestUndo(1)
		g.ReplyUndo(true)
	}
	g.Move(1, 5, 5)
	if g.RequestUndo(1) {
		if g.UndoUsed(1) > 2 {
			t.Fatal("undo exceeded cap")
		}
	}
}

func TestResign(t *testing.T) {
	g := NewGame(1, 2)
	res := g.Resign(1)
	if res.Winner != 2 || res.Reason != "resign" {
		t.Fatalf("resign wrong: %+v", res)
	}
}
