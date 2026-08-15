// Package room 的 game.go 是房间对战的纯状态机（无网络）：轮转、裁判、悔棋、认输。
package room

import (
	"errors"

	"github.com/wzq/gomoku/internal/gomoku"
)

// ErrNotYourTurn 表示当前并非该玩家的回合。
var ErrNotYourTurn = errors.New("not your turn")

// moveRec 记录一手落子（用于悔棋时重建棋盘）。
type moveRec struct {
	uid  int64
	x, y int
}

// Result 表示对局结束的裁决结果。
type Result struct {
	Winner int64
	Reason string
}

// Game 是单局对战的纯状态机：维护棋盘、轮转、历史与悔棋配额。
type Game struct {
	black, white int64
	board        *gomoku.Board
	turnUID      int64
	history      []moveRec
	over         bool
	undoUsed     map[int64]int
	pendingUndo  int64
	pendingSteps int
}

// NewGame 创建一局对战，黑方先行。
func NewGame(black, white int64) *Game {
	return &Game{black: black, white: white, board: gomoku.NewBoard(), turnUID: black, undoUsed: map[int64]int{}}
}

// Turn 返回当前应落子玩家的 uid。
func (g *Game) Turn() int64 { return g.turnUID }

// MovesCount 返回已落子数。
func (g *Game) MovesCount() int { return len(g.history) }

// UndoUsed 返回某玩家已使用的悔棋次数。
func (g *Game) UndoUsed(uid int64) int { return g.undoUsed[uid] }

// colorOf 返回玩家对应的棋色。
func (g *Game) colorOf(uid int64) gomoku.Color {
	if uid == g.black {
		return gomoku.Black
	}
	return gomoku.White
}

// other 返回对手的 uid。
func (g *Game) other(uid int64) int64 {
	if uid == g.black {
		return g.white
	}
	return g.black
}

// Move 处理一手落子：校验回合、落子、判胜、切换回合。
func (g *Game) Move(uid int64, x, y int) (*Result, error) {
	if g.over {
		return nil, errors.New("game over")
	}
	if uid != g.turnUID {
		return nil, ErrNotYourTurn
	}
	if err := g.board.Apply(x, y, g.colorOf(uid)); err != nil {
		return nil, err
	}
	g.history = append(g.history, moveRec{uid, x, y})
	g.pendingUndo = 0
	g.pendingSteps = 0
	if g.board.CheckWin(x, y) != "" {
		g.over = true
		return &Result{Winner: uid, Reason: "five"}, nil
	}
	g.turnUID = g.other(uid)
	return nil, nil
}

// RequestUndo 发起悔棋请求：撤销最近 steps 手。需未结束、有足够历史、且请求方悔棋未超配额（每人 3 次）。
func (g *Game) RequestUndo(uid int64, steps int) bool {
	if g.over || steps < 1 || len(g.history) < steps || g.undoUsed[uid] >= 3 {
		return false
	}
	g.pendingUndo = uid
	g.pendingSteps = steps
	return true
}

// ReplyUndo 应答悔棋：同意则撤销 steps 手、依剩余手数奇偶定轮次（黑先）。
// 返回 (是否同意, 实际撤销手数, 发起者 uid)，供上层广播结果/toast。
func (g *Game) ReplyUndo(agree bool) (bool, int, int64) {
	requester := g.pendingUndo
	steps := g.pendingSteps
	g.pendingUndo = 0
	g.pendingSteps = 0
	if requester == 0 || !agree {
		return false, steps, requester
	}
	n := steps
	if n > len(g.history) {
		n = len(g.history)
	}
	g.history = g.history[:len(g.history)-n]
	g.rebuild()
	// 依剩余手数奇偶决定轮到谁（黑先落子：偶数手后轮黑，奇数手后轮白）。
	if len(g.history)%2 == 0 {
		g.turnUID = g.black
	} else {
		g.turnUID = g.white
	}
	g.over = false
	g.undoUsed[requester]++
	return true, n, requester
}

// rebuild 依据历史重放，重建棋盘状态。
func (g *Game) rebuild() {
	g.board = gomoku.NewBoard()
	for _, m := range g.history {
		g.board.Apply(m.x, m.y, g.colorOf(m.uid))
	}
}

// Resign 认输：对手获胜。
func (g *Game) Resign(uid int64) *Result {
	g.over = true
	return &Result{Winner: g.other(uid), Reason: "resign"}
}

// Timeout 超时判负：当前回合方判负。
func (g *Game) Timeout() *Result {
	g.over = true
	return &Result{Winner: g.other(g.turnUID), Reason: "timeout"}
}

// Leave 离开判负：离开方判负。
func (g *Game) Leave(uid int64) *Result {
	g.over = true
	return &Result{Winner: g.other(uid), Reason: "leave"}
}
