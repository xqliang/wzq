// Package room 的 matcher.go：随机匹配池。
//
// 设计要点（对齐产品诉求「不预先分配房间，同时匹配的人随机组合进一个房间」）：
//   - 独自点「随机匹配」的人只是进入等待池（waiters），此时**不建房**，避免其中途离开
//     留下无人的僵尸房间与被污染的等待位。
//   - 后到者从池中取一个他人即刻配对，此刻才 Create 一个新房间；被取走的等待方通过下一次
//     轮询（Match 再调用一次）从 matched 表领取自己的房间号。
//   - 并发安全：waiters/matched 的全部读写都在 matchMu 下串行完成；建房用 Hub.Create（独立
//     锁 h.mu），Match 只持有 matchMu 再去调 Create，锁获取顺序单向，不会与其他路径互锁。
//
// 约束保证：
//   - 一个房间只 2 人：房间在「恰好两人配上」的瞬间创建，且 Room.addPlayer 上限为 2。
//   - 一个人同时只在一个匹配态：同一 uid 不会重复入池（命中即刷新心跳），也不会与自己配对。
package room

import "time"

// matchTTL 是等待者的心跳超时：超过该时长未再轮询（Match）即视为离开，从池中清除。
// 前端约 1.5s 轮询一次，15s 相当于容忍约 10 次漏轮询，足够覆盖网络抖动而不会滞留僵尸等待位。
const matchTTL = 15 * time.Second

// waiter 是匹配池中的一个等待者：uid + 最近一次轮询时间（心跳）。
type waiter struct {
	uid  int64
	seen time.Time
}

// Match 将 uid 投入随机匹配池并尝试即时配对。
//
// 返回：
//   - waiting=true：尚未配到对手，已在池中等待；roomID 为空，调用方应稍后再次调用（轮询）。
//   - waiting=false：配对成功，roomID 为双方对局房间号，直接连入即可。
//
// 幂等：已在池中的 uid 重复调用只刷新心跳；已被配走的 uid 调用则领取房间并出表。
func (h *Hub) Match(uid int64) (roomID string, waiting bool) {
	h.matchMu.Lock()
	defer h.matchMu.Unlock()
	now := time.Now()
	h.pruneWaitersLocked(now)

	// 1) 已被他人配走：领取房间号并从 matched 出表。
	if rid, ok := h.matched[uid]; ok {
		delete(h.matched, uid)
		return rid, false
	}
	// 2) 已在等待池：刷新心跳，继续等待（避免重复入池 -> 保证「一人只在一个匹配态」）。
	for i := range h.waiters {
		if h.waiters[i].uid == uid {
			h.waiters[i].seen = now
			return "", true
		}
	}
	// 3) 从池中取一个「不是自己」的等待者，即刻配对并建房。
	for len(h.waiters) > 0 {
		p := h.waiters[0]
		h.waiters = h.waiters[1:]
		if p.uid == uid {
			continue // 理论上第 2 步已排除自己，这里再兜底一次。
		}
		rid := h.Create(p.uid)  // 恰好两人配上才建房；owner 记等待方仅占位，黑白由 WS 连接先后决定。
		h.matched[p.uid] = rid  // 等待方下次轮询到此领取。
		return rid, false
	}
	// 4) 池空：入池等待。
	h.waiters = append(h.waiters, waiter{uid: uid, seen: now})
	return "", true
}

// CancelMatch 让 uid 主动退出匹配池（离开匹配界面 / 点取消时调用）。
// 同时清掉其可能残留的 matched 领取项，避免离开后又被误引导进僵尸房间。
func (h *Hub) CancelMatch(uid int64) {
	h.matchMu.Lock()
	defer h.matchMu.Unlock()
	h.removeWaiterLocked(uid)
	delete(h.matched, uid)
}

// pruneWaitersLocked 清除心跳超过 matchTTL 的等待者（关页/断网后不再轮询者）。
// 调用方必须已持有 matchMu。使用原地过滤（waiters[:0]），零额外分配。
func (h *Hub) pruneWaitersLocked(now time.Time) {
	kept := h.waiters[:0]
	for _, w := range h.waiters {
		if now.Sub(w.seen) <= matchTTL {
			kept = append(kept, w)
		}
	}
	h.waiters = kept
}

// removeWaiterLocked 从池中移除指定 uid。调用方必须已持有 matchMu。
func (h *Hub) removeWaiterLocked(uid int64) {
	kept := h.waiters[:0]
	for _, w := range h.waiters {
		if w.uid != uid {
			kept = append(kept, w)
		}
	}
	h.waiters = kept
}
