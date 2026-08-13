package room

import "testing"

func TestHubCreateAndJoin(t *testing.T) {
	h := NewHub()
	id := h.Create(1)
	if id == "" {
		t.Fatal("empty room id")
	}
	r, ok := h.Get(id)
	if !ok {
		t.Fatal("room not found")
	}
	if err := r.addPlayer(1); err != nil {
		t.Fatal(err)
	}
	if err := r.addPlayer(2); err != nil {
		t.Fatal(err)
	}
	if err := r.addPlayer(3); err == nil {
		t.Fatal("third player should be rejected")
	}
}

// TestFinishInvokesGameOver 验证 finish 会以正确的黑白双方与胜者信息触发一次 Hub 级回调。
func TestFinishInvokesGameOver(t *testing.T) {
	var got GameOver
	calls := 0
	h := NewHub()
	h.SetOnGameOver(func(o GameOver) {
		calls++
		got = o
	})
	// 直接构造 Room + Game，走 finish 的导出前路径；clients 用空 map 避免 broadcast nil map。
	r := &Room{ID: "t", clients: map[int64]*client{}, hub: h, game: NewGame(11, 22)}
	// 黑方（11）落一手后以 five 结束，构造一个合理的结果。
	r.game.Move(11, 7, 7)
	r.finish(&Result{Winner: 11, Reason: "five"})
	if calls != 1 {
		t.Fatalf("callback calls=%d want 1", calls)
	}
	if got.Black != 11 || got.White != 22 || got.Winner != 11 {
		t.Fatalf("got %+v want Black=11 White=22 Winner=11", got)
	}
	if got.Reason != "five" || got.Moves != 1 {
		t.Fatalf("got reason=%q moves=%d want five/1", got.Reason, got.Moves)
	}
}
