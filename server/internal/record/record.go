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

// Stats 表示某用户的战绩统计概要。
type Stats struct {
	Total    int `json:"total"`
	Wins     int `json:"wins"`
	Losses   int `json:"losses"`
	WinRate  int `json:"winRate"` // 百分比整数
	Streak   int `json:"streak"`  // 当前连胜
	AIGames  int `json:"aiGames"`
	PvPGames int `json:"pvpGames"`
}

// StatsFor 统计某用户参与的全部对局：总局/胜/负/胜率/当前连胜/人机与真人局数。
// 连胜从最近一局往前数，遇到第一场非胜（负或平）即停止。
func (svc *Service) StatsFor(uid int64) (Stats, error) {
	var st Stats
	rows, err := svc.s.DB.Query(
		`SELECT mode, black_uid, white_uid, winner FROM game_record WHERE black_uid=? OR white_uid=? ORDER BY id`, uid, uid)
	if err != nil {
		return st, err
	}
	defer rows.Close()
	// wonSeq 按时间顺序记录每局该用户是否获胜，稍后逆序求连胜。
	var wonSeq []bool
	for rows.Next() {
		var mode, winner string
		var blackUID, whiteUID int64
		if err := rows.Scan(&mode, &blackUID, &whiteUID, &winner); err != nil {
			return st, err
		}
		st.Total++
		switch mode {
		case "ai":
			st.AIGames++
		case "pvp":
			st.PvPGames++
		}
		isBlack := blackUID == uid
		won := (winner == "black" && isBlack) || (winner == "white" && !isBlack)
		if won {
			st.Wins++
		} else if winner == "black" || winner == "white" {
			// 明确分出胜负且非本方获胜才计负；平局（draw）不计入胜负。
			st.Losses++
		}
		wonSeq = append(wonSeq, won)
	}
	if err := rows.Err(); err != nil {
		return st, err
	}
	if st.Total > 0 {
		st.WinRate = int((float64(st.Wins)*100/float64(st.Total)) + 0.5)
	}
	// 从最近一局往前数连胜。
	for i := len(wonSeq) - 1; i >= 0; i-- {
		if !wonSeq[i] {
			break
		}
		st.Streak++
	}
	return st, nil
}
