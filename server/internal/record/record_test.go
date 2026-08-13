package record

import (
	"testing"
	"time"

	"github.com/wzq/gomoku/internal/store"
)

func TestSaveGameAndMoves(t *testing.T) {
	s, _ := store.Open("sqlite", ":memory:")
	s.Migrate()
	svc := New(s)
	g := Game{
		Mode: "pvp", BlackUID: 1, WhiteUID: 2, Winner: "black",
		Moves: 2, Duration: 30, EndReason: "five", CreatedAt: time.Now(),
		MoveList: []Move{{Seq: 1, Color: "black", X: 7, Y: 7}, {Seq: 2, Color: "white", X: 8, Y: 8}},
	}
	id, err := svc.Save(g)
	if err != nil {
		t.Fatal(err)
	}
	var n int
	s.DB.QueryRow(`SELECT COUNT(*) FROM game_move WHERE game_id=?`, id).Scan(&n)
	if n != 2 {
		t.Fatalf("moves saved=%d want 2", n)
	}
}
