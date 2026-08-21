// Package room 的 hub.go：内存房间管理 + WebSocket 传输 + 每步计时。
package room

import (
	"errors"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// turnSeconds 是每一步的思考时限（秒），超时判负。
const turnSeconds = 30

// client 表示一个已连接玩家：uid + 连接 + 发送队列。
type client struct {
	uid  int64
	conn *websocket.Conn
	send chan ServerMsg
}

// GameOver 携带一局对战结束时的完整信息，供上层结算经验与落库战绩。
type GameOver struct {
	Black, White, Winner int64
	Reason               string
	Moves                int
}

// Room 表示一个内存房间：最多两名玩家，持有对局状态机与回合计时器。
type Room struct {
	ID      string
	mu      sync.Mutex
	players []int64
	clients map[int64]*client
	game    *Game
	timer   *time.Timer
	onOver  func(r *Room, res *Result)
	hub     *Hub // 反向引用，用于在对局结束时回调 Hub 级别的结算钩子。
}

// addPlayer 将玩家加入房间；已在房则幂等返回，满员返回错误。
func (r *Room) addPlayer(uid int64) error {
	for _, p := range r.players {
		if p == uid {
			return nil
		}
	}
	if len(r.players) >= 2 {
		return errors.New("room full")
	}
	r.players = append(r.players, uid)
	return nil
}

// Hub 管理全部内存房间、随机匹配池与 WebSocket 升级器。
type Hub struct {
	mu         sync.Mutex
	rooms      map[string]*Room
	up         websocket.Upgrader
	onGameOver func(GameOver)     // 对局结束时的全局结算钩子（可选）。
	metaOf     func(int64) PlayerMeta // 查询玩家资料（段位/头像/框/特效），用于开局下发对手信息（可选）。

	// 随机匹配池：不为独自等待者预建房，两人真正配上才建房。
	// matchMu 串行化 waiters/matched 的读写；建房走 Hub.Create（独立锁 h.mu，无嵌套死锁）。
	matchMu sync.Mutex
	waiters []waiter         // 等待配对的玩家队列（FIFO），仅存 uid + 最近心跳时间。
	matched map[int64]string // 等待方被他人配走后，此处记下其房间号，供其下次轮询领取。
}

// NewHub 构造 Hub，允许任意来源的跨域升级（前端与后端可能不同源）。
func NewHub() *Hub {
	return &Hub{
		rooms:   map[string]*Room{},
		matched: map[int64]string{},
		up:      websocket.Upgrader{CheckOrigin: func(*http.Request) bool { return true }},
	}
}

// SetOnGameOver 注册对局结束回调（用于结算 PvP 经验与落库战绩）。
func (h *Hub) SetOnGameOver(f func(GameOver)) { h.onGameOver = f }

// PlayerMeta 是开局下发给对手的玩家资料（段位阶/头像/头像框/落子特效）。
type PlayerMeta struct {
	Tier   int
	Avatar string
	Frame  string
	Effect string
}

// SetPlayerMeta 注册玩家资料查询函数（开局时给每位玩家下发对手资料）。
func (h *Hub) SetPlayerMeta(f func(int64) PlayerMeta) { h.metaOf = f }

// meta 安全查询玩家资料；未注册则返回零值。
func (h *Hub) meta(uid int64) PlayerMeta {
	if h.metaOf == nil {
		return PlayerMeta{}
	}
	return h.metaOf(uid)
}

// Create 创建一个新房间并返回 8 位房间号。
func (h *Hub) Create(owner int64) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	id := uuid.NewString()[:8]
	h.rooms[id] = &Room{ID: id, clients: map[int64]*client{}, hub: h}
	return id
}

// Get 按房间号查询房间。
func (h *Hub) Get(id string) (*Room, bool) {
	h.mu.Lock()
	defer h.mu.Unlock()
	r, ok := h.rooms[id]
	return r, ok
}

// broadcast 向房间所有客户端投递消息（发送队列满则丢弃，避免阻塞）。
func (r *Room) broadcast(m ServerMsg) {
	for _, c := range r.clients {
		select {
		case c.send <- m:
		default:
		}
	}
}

// sendTo 向指定玩家投递消息。
func (r *Room) sendTo(uid int64, m ServerMsg) {
	if c, ok := r.clients[uid]; ok {
		select {
		case c.send <- m:
		default:
		}
	}
}

// startTurnTimer 广播当前回合与截止时间，并启动超时判负计时。
func (r *Room) startTurnTimer() {
	if r.timer != nil {
		r.timer.Stop()
	}
	deadline := time.Now().Add(turnSeconds * time.Second)
	r.broadcast(ServerMsg{Type: "turn", UID: r.game.Turn(), Deadline: deadline.UnixMilli()})
	r.timer = time.AfterFunc(turnSeconds*time.Second, func() {
		r.mu.Lock()
		defer r.mu.Unlock()
		if r.game == nil || r.game.over {
			return
		}
		r.finish(r.game.Timeout())
	})
}

// finish 结束对局：停表、广播结果、触发 onOver 回调（若有）、再触发 Hub 级结算钩子。
func (r *Room) finish(res *Result) {
	if r.timer != nil {
		r.timer.Stop()
	}
	r.broadcast(ServerMsg{Type: "game_over", Winner: res.Winner, Reason: res.Reason})
	if r.onOver != nil {
		r.onOver(r, res)
	}
	if r.hub != nil && r.hub.onGameOver != nil && r.game != nil {
		r.hub.onGameOver(GameOver{
			Black:  r.game.black,
			White:  r.game.white,
			Winner: res.Winner,
			Reason: res.Reason,
			Moves:  r.game.MovesCount(),
		})
	}
}

// ServeWS 升级连接、加入房间、满两人开局，并驱动读写循环。
func (h *Hub) ServeWS(w http.ResponseWriter, req *http.Request, roomID string, uid int64) {
	r, ok := h.Get(roomID)
	if !ok {
		http.Error(w, "room not found", http.StatusNotFound)
		return
	}
	conn, err := h.up.Upgrade(w, req, nil)
	if err != nil {
		return
	}
	c := &client{uid: uid, conn: conn, send: make(chan ServerMsg, 16)}
	r.mu.Lock()
	if err := r.addPlayer(uid); err != nil {
		r.mu.Unlock()
		conn.Close()
		return
	}
	r.clients[uid] = c
	players := len(r.players)
	r.mu.Unlock()
	go c.writeLoop()
	c.send <- ServerMsg{Type: "room_state", Players: players}
	r.mu.Lock()
	// 双方当前都在线且尚无对局（或上一局已结束）时开新局。
	// 支持「再来一局」：对局结束后双方重连同一房间即自动开新局，无需新建房间。
	bothConnected := len(r.players) == 2 && r.clients[r.players[0]] != nil && r.clients[r.players[1]] != nil
	if bothConnected && (r.game == nil || r.game.over) {
		// 随机决定谁执黑先手（黑先落子），双方执黑概率均等。
		black, white := r.players[0], r.players[1]
		if rand.Intn(2) == 1 {
			black, white = white, black
		}
		r.game = NewGame(black, white)
		mB, mW := r.hub.meta(black), r.hub.meta(white)
		r.sendTo(black, ServerMsg{Type: "start", Color: "black", OppTier: mW.Tier, OppAvatar: mW.Avatar, OppFrame: mW.Frame, OppEffect: mW.Effect})
		r.sendTo(white, ServerMsg{Type: "start", Color: "white", OppTier: mB.Tier, OppAvatar: mB.Avatar, OppFrame: mB.Frame, OppEffect: mB.Effect})
		r.startTurnTimer()
	}
	r.mu.Unlock()
	c.readLoop(r)
}

// writeLoop 从发送队列取出消息并写到连接。
func (c *client) writeLoop() {
	for m := range c.send {
		if err := c.conn.WriteJSON(m); err != nil {
			return
		}
	}
}

// readLoop 循环读取客户端消息并派发；断线则清理并按需判离场负。
func (c *client) readLoop(r *Room) {
	defer func() {
		c.conn.Close()
		r.mu.Lock()
		delete(r.clients, c.uid)
		if r.game != nil && !r.game.over {
			r.finish(r.game.Leave(c.uid))
		}
		r.mu.Unlock()
	}()
	for {
		var msg ClientMsg
		if err := c.conn.ReadJSON(&msg); err != nil {
			return
		}
		r.handle(c.uid, msg)
	}
}

// handle 处理单条客户端消息：落子/悔棋请求/悔棋应答/认输。
func (r *Room) handle(uid int64, msg ClientMsg) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.game == nil {
		return
	}
	switch msg.Type {
	case "move":
		res, err := r.game.Move(uid, msg.X, msg.Y)
		if err != nil {
			return
		}
		r.broadcast(ServerMsg{Type: "move", UID: uid, X: msg.X, Y: msg.Y, Seq: r.game.MovesCount()})
		if res != nil {
			r.finish(res)
		} else {
			r.startTurnTimer()
		}
	case "undo_req":
		if r.game.RequestUndo(uid, msg.Steps) {
			// 只通知对手（不把请求回推给发起者自己）。
			for _, p := range r.players {
				if p != uid {
					r.sendTo(p, ServerMsg{Type: "undo_req", UID: uid, N: msg.Steps})
				}
			}
		}
	case "undo_reply":
		agreed, steps, requester := r.game.ReplyUndo(msg.Agree)
		// 广播结果：双方据此回退棋盘，发起者据 uid 判断给自己弹 toast。
		r.broadcast(ServerMsg{Type: "undo_result", Agree: agreed, N: steps, UID: requester})
		if agreed {
			r.startTurnTimer()
		}
	case "resign":
		r.finish(r.game.Resign(uid))
	case "emote":
		// 表情/快捷语：广播给房间内所有玩家（含发送者自己，便于双方头像下同步展示）。
		// 限长截断（按 rune 计），避免恶意超长文本刷屏。
		r.broadcast(ServerMsg{Type: "emote", UID: uid, Text: emoteText(msg.Text)})
	}
}

// emoteText 规整表情/快捷语文本：去除首尾空白、限长（32 个字符）。
func emoteText(s string) string {
	s = strings.TrimSpace(s)
	runes := []rune(s)
	if len(runes) > 32 {
		return string(runes[:32])
	}
	return string(runes)
}
