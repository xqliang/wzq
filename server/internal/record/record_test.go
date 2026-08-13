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

func TestStatsFor(t *testing.T) {
	s, _ := store.Open("sqlite", ":memory:")
	s.Migrate()
	svc := New(s)
	// uid=1 视角：以下按插入顺序即时间顺序（id 递增）。
	// 1) pvp 黑胜 -> 1 赢
	// 2) ai  黑胜 -> 1 赢（1 是黑）
	// 3) pvp 白胜 -> 1 输（1 是黑）
	// 4) pvp 白胜 -> 1 赢（1 是白）
	// 5) pvp 黑胜 -> 1 赢（1 是白？不，5 让 1 作黑）
	games := []Game{
		{Mode: "pvp", BlackUID: 1, WhiteUID: 2, Winner: "black", CreatedAt: time.Now()}, // win
		{Mode: "ai", BlackUID: 1, WhiteUID: 0, Winner: "black", CreatedAt: time.Now()},  // win
		{Mode: "pvp", BlackUID: 1, WhiteUID: 2, Winner: "white", CreatedAt: time.Now()}, // loss
		{Mode: "pvp", BlackUID: 2, WhiteUID: 1, Winner: "white", CreatedAt: time.Now()}, // win (1 白)
		{Mode: "pvp", BlackUID: 1, WhiteUID: 2, Winner: "black", CreatedAt: time.Now()}, // win (1 黑)
	}
	for _, g := range games {
		if _, err := svc.Save(g); err != nil {
			t.Fatal(err)
		}
	}
	st, err := svc.StatsFor(1)
	if err != nil {
		t.Fatal(err)
	}
	if st.Total != 5 {
		t.Fatalf("total=%d want 5", st.Total)
	}
	if st.Wins != 4 {
		t.Fatalf("wins=%d want 4", st.Wins)
	}
	if st.Losses != 1 {
		t.Fatalf("losses=%d want 1", st.Losses)
	}
	if st.WinRate != 80 {
		t.Fatalf("winRate=%d want 80", st.WinRate)
	}
	// 最近两局（id 4、5）均为胜，第 3 局为负 -> 连胜 2。
	if st.Streak != 2 {
		t.Fatalf("streak=%d want 2", st.Streak)
	}
	if st.AIGames != 1 {
		t.Fatalf("aiGames=%d want 1", st.AIGames)
	}
	if st.PvPGames != 4 {
		t.Fatalf("pvpGames=%d want 4", st.PvPGames)
	}
	// 空用户：全 0，不报错。
	empty, err := svc.StatsFor(999)
	if err != nil {
		t.Fatal(err)
	}
	if empty.Total != 0 || empty.WinRate != 0 || empty.Streak != 0 {
		t.Fatalf("empty stats not zero: %+v", empty)
	}
}

func TestAdminQueries(t *testing.T) {
	s, _ := store.Open("sqlite", ":memory:")
	s.Migrate()
	svc := New(s)
	// 造两条 ai、一条 pvp 对局记录。
	games := []Game{
		{Mode: "ai", AILevel: 3, BlackUID: 1, WhiteUID: 0, Winner: "black", Moves: 10, EndReason: "ai", CreatedAt: time.Now()},
		{Mode: "ai", AILevel: 5, BlackUID: 2, WhiteUID: 0, Winner: "white", Moves: 20, EndReason: "ai", CreatedAt: time.Now()},
		{Mode: "pvp", BlackUID: 1, WhiteUID: 2, Winner: "black", Moves: 30, EndReason: "five", CreatedAt: time.Now()},
	}
	for _, g := range games {
		if _, err := svc.Save(g); err != nil {
			t.Fatal(err)
		}
	}
	ai, pvp, err := svc.TotalGames()
	if err != nil {
		t.Fatal(err)
	}
	if ai != 2 || pvp != 1 {
		t.Fatalf("TotalGames ai=%d pvp=%d want 2/1", ai, pvp)
	}
	recent, err := svc.RecentGames(10)
	if err != nil {
		t.Fatal(err)
	}
	if len(recent) != 3 {
		t.Fatalf("RecentGames len=%d want 3", len(recent))
	}
	// 倒序：最近插入的 pvp 局应排在最前。
	if recent[0].Mode != "pvp" || recent[0].Moves != 30 {
		t.Fatalf("RecentGames[0]=%+v want pvp/30", recent[0])
	}
	if recent[0].CreatedAt == "" {
		t.Fatalf("RecentGames[0].CreatedAt empty")
	}
	// 造两条残局进度：一条已通关、一条未通关。
	s.DB.Exec(`INSERT INTO endgame_progress (uid, level_id, passed, attempts, hints) VALUES (?,?,?,?,?)`, 1, "L1", 1, 3, 0)
	s.DB.Exec(`INSERT INTO endgame_progress (uid, level_id, passed, attempts, hints) VALUES (?,?,?,?,?)`, 1, "L2", 0, 1, 1)
	passes, err := svc.EndgamePasses()
	if err != nil {
		t.Fatal(err)
	}
	if passes != 1 {
		t.Fatalf("EndgamePasses=%d want 1", passes)
	}
}
