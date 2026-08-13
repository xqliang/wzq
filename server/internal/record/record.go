// Package record 落库对局概要与逐手棋谱。
package record

import (
	"database/sql"
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

// AdminGame 表示运营后台展示用的对局概要（不含逐手棋谱）。
type AdminGame struct {
	ID        int64  `json:"id"`
	Mode      string `json:"mode"`
	AILevel   int    `json:"aiLevel"`
	BlackUID  int64  `json:"blackUid"`
	WhiteUID  int64  `json:"whiteUid"`
	Winner    string `json:"winner"`
	Moves     int    `json:"moves"`
	EndReason string `json:"endReason"`
	CreatedAt string `json:"createdAt"`
}

// TotalGames 统计人机（ai）与真人（pvp）对局总数。
func (svc *Service) TotalGames() (ai int, pvp int, err error) {
	rows, err := svc.s.DB.Query(`SELECT mode, COUNT(*) FROM game_record GROUP BY mode`)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()
	for rows.Next() {
		var mode string
		var n int
		if err := rows.Scan(&mode, &n); err != nil {
			return 0, 0, err
		}
		switch mode {
		case "ai":
			ai = n
		case "pvp":
			pvp = n
		}
	}
	return ai, pvp, rows.Err()
}

// RecentGames 返回最近的对局记录（按 id 倒序），供运营后台列表展示。
// 兼容可空字段：ai_level 与 white_uid 用 NullInt64，created_at 直接扫描为字符串。
func (svc *Service) RecentGames(limit int) ([]AdminGame, error) {
	rows, err := svc.s.DB.Query(
		`SELECT id, mode, ai_level, black_uid, white_uid, winner, moves, end_reason, created_at
		 FROM game_record ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	// 预分配为空切片，保证 JSON 序列化为 [] 而非 null。
	games := []AdminGame{}
	for rows.Next() {
		var g AdminGame
		var aiLevel, whiteUID sql.NullInt64
		var createdAt sql.NullString
		if err := rows.Scan(&g.ID, &g.Mode, &aiLevel, &g.BlackUID, &whiteUID, &g.Winner, &g.Moves, &g.EndReason, &createdAt); err != nil {
			return nil, err
		}
		g.AILevel = int(aiLevel.Int64)
		g.WhiteUID = whiteUID.Int64
		g.CreatedAt = createdAt.String
		games = append(games, g)
	}
	return games, rows.Err()
}

// EndgamePasses 返回已通关的残局进度条数（passed=1）。
func (svc *Service) EndgamePasses() (int, error) {
	var n int
	err := svc.s.DB.QueryRow(`SELECT COUNT(*) FROM endgame_progress WHERE passed=1`).Scan(&n)
	return n, err
}
