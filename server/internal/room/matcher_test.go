package room

import (
	"sync"
	"testing"
	"time"
)

// TestMatchPairsTwo 验证：第一人入池等待，第二人到来即刻配对成功；
// 被配走的第一人再次轮询能领取到同一房间号。
func TestMatchPairsTwo(t *testing.T) {
	h := NewHub()
	if rid, waiting := h.Match(1); !waiting || rid != "" {
		t.Fatalf("first matcher want waiting/empty, got room=%q waiting=%v", rid, waiting)
	}
	rid2, waiting2 := h.Match(2)
	if waiting2 || rid2 == "" {
		t.Fatalf("second matcher want paired/room, got room=%q waiting=%v", rid2, waiting2)
	}
	// 第一人轮询领取，房间号应与第二人一致。
	rid1, waiting1 := h.Match(1)
	if waiting1 || rid1 != rid2 {
		t.Fatalf("first matcher poll want room=%q not-waiting, got room=%q waiting=%v", rid2, rid1, waiting1)
	}
	// 领取后应出表：再次轮询会被当作新的一次入池等待。
	if _, waiting := h.Match(1); !waiting {
		t.Fatalf("first matcher after claim should re-enter pool as waiting")
	}
}

// TestMatchIdempotentWaiting 验证：同一 uid 重复请求只刷新心跳，不重复入池。
func TestMatchIdempotentWaiting(t *testing.T) {
	h := NewHub()
	h.Match(1)
	h.Match(1)
	h.Match(1)
	h.matchMu.Lock()
	n := len(h.waiters)
	h.matchMu.Unlock()
	if n != 1 {
		t.Fatalf("waiters=%d want 1 (no duplicate enqueue)", n)
	}
}

// TestMatchNoRoomForLoneWaiter 验证：独自等待者不预建任何房间（核心诉求）。
func TestMatchNoRoomForLoneWaiter(t *testing.T) {
	h := NewHub()
	h.Match(1)
	h.mu.Lock()
	n := len(h.rooms)
	h.mu.Unlock()
	if n != 0 {
		t.Fatalf("rooms=%d want 0 for a lone waiter (no pre-allocation)", n)
	}
}

// TestMatchPruneStaleWaiter 验证：超过 matchTTL 未轮询的等待者会被清理。
func TestMatchPruneStaleWaiter(t *testing.T) {
	h := NewHub()
	h.Match(1)
	// 手动将其心跳回拨到过期之前。
	h.matchMu.Lock()
	h.waiters[0].seen = time.Now().Add(-matchTTL - time.Second)
	h.matchMu.Unlock()
	// 第二人到来时，过期的第一人应被清理 -> 第二人无人可配，自己入池等待。
	if _, waiting := h.Match(2); !waiting {
		t.Fatalf("stale waiter should be pruned, second matcher should wait")
	}
	h.matchMu.Lock()
	defer h.matchMu.Unlock()
	if len(h.waiters) != 1 || h.waiters[0].uid != 2 {
		t.Fatalf("pool=%+v want only uid=2", h.waiters)
	}
}

// TestCancelMatch 验证：取消后退出池，后来者无人可配。
func TestCancelMatch(t *testing.T) {
	h := NewHub()
	h.Match(1)
	h.CancelMatch(1)
	if _, waiting := h.Match(2); !waiting {
		t.Fatalf("after cancel, second matcher should wait (nobody to pair)")
	}
}

// TestMatchConcurrent 并发压力：N 个玩家各自「轮询到配上为止」，
// 断言最终恰好配成 N/2 个房间，每房 2 个不同 uid，无人重复进两房。
func TestMatchConcurrent(t *testing.T) {
	const N = 100 // 偶数，期望全部配对
	h := NewHub()

	var mu sync.Mutex
	roomOf := map[int64]string{} // uid -> 最终房间号

	var wg sync.WaitGroup
	for uid := int64(1); uid <= N; uid++ {
		wg.Add(1)
		go func(uid int64) {
			defer wg.Done()
			// 模拟前端轮询：直到 waiting=false 拿到房间号。
			for i := 0; i < 10000; i++ {
				rid, waiting := h.Match(uid)
				if !waiting {
					mu.Lock()
					roomOf[uid] = rid
					mu.Unlock()
					return
				}
				time.Sleep(time.Millisecond)
			}
			t.Errorf("uid=%d never matched", uid)
		}(uid)
	}
	wg.Wait()

	// 全部拿到房间号。
	if len(roomOf) != N {
		t.Fatalf("matched uids=%d want %d", len(roomOf), N)
	}
	// 每个房间恰好 2 个不同 uid。
	occupants := map[string][]int64{}
	for uid, rid := range roomOf {
		occupants[rid] = append(occupants[rid], uid)
	}
	if len(occupants) != N/2 {
		t.Fatalf("rooms=%d want %d", len(occupants), N/2)
	}
	for rid, us := range occupants {
		if len(us) != 2 {
			t.Fatalf("room %s has %d occupants want 2", rid, len(us))
		}
		if us[0] == us[1] {
			t.Fatalf("room %s paired a uid with itself", rid)
		}
	}
	// 池应清空（偶数全部配对）。
	h.matchMu.Lock()
	left := len(h.waiters)
	h.matchMu.Unlock()
	if left != 0 {
		t.Fatalf("waiters left=%d want 0 for even N", left)
	}
}

// TestMatchConcurrentOdd 奇数并发：应恰好剩 1 人仍在等待。
func TestMatchConcurrentOdd(t *testing.T) {
	const N = 51
	h := NewHub()

	var wg sync.WaitGroup
	var matchedCount int64
	var cmu sync.Mutex
	// 每人最多轮询有限次；奇数下必有 1 人一直等待，故不能无限轮询。
	for uid := int64(1); uid <= N; uid++ {
		wg.Add(1)
		go func(uid int64) {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				if _, waiting := h.Match(uid); !waiting {
					cmu.Lock()
					matchedCount++
					cmu.Unlock()
					return
				}
				time.Sleep(time.Millisecond)
			}
		}(uid)
	}
	wg.Wait()

	if matchedCount != N-1 {
		t.Fatalf("matched=%d want %d (exactly one left waiting)", matchedCount, N-1)
	}
}
