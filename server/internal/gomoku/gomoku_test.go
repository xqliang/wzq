package gomoku

import "testing"

func TestApplyAndWin(t *testing.T) {
	b := NewBoard()
	for x := 3; x <= 7; x++ {
		if err := b.Apply(x, 7, Black); err != nil {
			t.Fatalf("apply: %v", err)
		}
	}
	if w := b.CheckWin(7, 7); w != Black {
		t.Fatalf("want black win, got %q", w)
	}
}

func TestIllegal(t *testing.T) {
	b := NewBoard()
	if err := b.Apply(0, 0, Black); err != nil {
		t.Fatal(err)
	}
	if err := b.Apply(0, 0, White); err == nil {
		t.Fatal("expected error placing on occupied cell")
	}
	if err := b.Apply(-1, 0, Black); err == nil {
		t.Fatal("expected error out of range")
	}
}

func TestNoWinFour(t *testing.T) {
	b := NewBoard()
	for x := 3; x <= 6; x++ {
		_ = b.Apply(x, 7, Black)
	}
	if w := b.CheckWin(6, 7); w != "" {
		t.Fatalf("four should not win, got %q", w)
	}
}
