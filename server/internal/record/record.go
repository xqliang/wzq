// Package record 落库对局概要与逐手棋谱。
package record

import (
	"time"

	"github.com/wzq/gomoku/internal/store"
)

// Move 表示一手落子的棋谱记录。
type Move struct {
	Seq   int
	Color string
	X, Y  int
}

// Game 表示一局对局的概要及其完整棋谱。
type Game struct {
	Mode      string
	AILevel   int
	BlackUID  int64
	WhiteUID  int64
	Winner    string
	Moves     int
	Duration  int
	EndReason string
	CreatedAt time.Time
	MoveList  []Move
}

// Service 提供对局落库能力，依赖底层 store。
type Service struct{ s *store.Store }

// New 构造 record 服务。
func New(s *store.Store) *Service { return &Service{s: s} }

// Save 先写入对局概要 game_record，再逐条写入棋谱 game_move，返回对局主键。
func (svc *Service) Save(g Game) (int64, error) {
	res, err := svc.s.DB.Exec(
		`INSERT INTO game_record (mode, ai_level, black_uid, white_uid, winner, moves, duration, end_reason, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
		g.Mode, g.AILevel, g.BlackUID, g.WhiteUID, g.Winner, g.Moves, g.Duration, g.EndReason, g.CreatedAt)
	if err != nil {
		return 0, err
	}
	id, _ := res.LastInsertId()
	for _, m := range g.MoveList {
		if _, err := svc.s.DB.Exec(`INSERT INTO game_move (game_id, seq, color, x, y, ts) VALUES (?,?,?,?,?,?)`, id, m.Seq, m.Color, m.X, m.Y, time.Now()); err != nil {
			return id, err
		}
	}
	return id, nil
}
