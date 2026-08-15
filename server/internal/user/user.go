// Package user 管理用户、经验与等级。
package user

import (
	"database/sql"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/wzq/gomoku/internal/rank"
	"github.com/wzq/gomoku/internal/store"
	"golang.org/x/crypto/bcrypt"
)

// User 表示一名用户（游客或已绑定账号）。
type User struct {
	ID       int64  `json:"id"`
	GuestID  string `json:"guestId"`
	Username string `json:"username,omitempty"`
	Nickname string `json:"nickname"`
	Avatar   string `json:"avatar"`
	Exp      int    `json:"exp"`
	Level    int    `json:"level"`
	// 段位（阶段B）：rankTier 为阶梯索引(0..18)，rankPoints 为当前阶内积分。
	RankTier   int `json:"rankTier"`
	RankPoints int `json:"rankPoints"`
}

// Service 提供用户相关业务能力，依赖底层 store。
type Service struct{ s *store.Store }

// New 构造用户服务。
func New(s *store.Store) *Service { return &Service{s: s} }

// levelThresholds 为各等级所需的最低累计经验（下标 i 对应等级 i+1）。
var levelThresholds = []int{0, 100, 500, 2000, 8000}

// LevelForExp 根据累计经验计算当前等级。
func LevelForExp(exp int) int {
	lvl := 1
	for i, th := range levelThresholds {
		if exp >= th {
			lvl = i + 1
		}
	}
	return lvl
}

// nickPrefix / nickSuffix 用于随机生成中式风格的游客昵称。
var nickPrefix = []string{"松", "竹", "梅", "兰", "石", "溪", "云", "山"}
var nickSuffix = []string{"客", "隐", "翁", "生", "子", "叟"}

// randomNick 生成形如「松客123」的随机昵称。
func randomNick() string {
	return nickPrefix[rand.Intn(len(nickPrefix))] + nickSuffix[rand.Intn(len(nickSuffix))] + fmt.Sprintf("%03d", rand.Intn(1000))
}

// CreateGuest 创建一名游客用户：分配 guestId、随机昵称，初始等级 1。
func (svc *Service) CreateGuest() (*User, error) {
	now := time.Now()
	u := &User{GuestID: uuid.NewString(), Nickname: randomNick(), Avatar: "avatar_01", Level: 1}
	res, err := svc.s.DB.Exec(
		`INSERT INTO user (guest_id, nickname, avatar, exp, level, created_at, last_login) VALUES (?,?,?,?,?,?,?)`,
		u.GuestID, u.Nickname, u.Avatar, 0, 1, now, now)
	if err != nil {
		return nil, err
	}
	u.ID, _ = res.LastInsertId()
	return u, nil
}

// Get 按主键查询用户。
func (svc *Service) Get(id int64) (*User, error) {
	u := &User{}
	var username sql.NullString
	err := svc.s.DB.QueryRow(
		`SELECT id, guest_id, username, nickname, avatar, exp, level, rank_tier, rank_points FROM user WHERE id=?`, id).
		Scan(&u.ID, &u.GuestID, &username, &u.Nickname, &u.Avatar, &u.Exp, &u.Level, &u.RankTier, &u.RankPoints)
	if err != nil {
		return nil, err
	}
	u.Username = username.String
	return u, nil
}

// AddExp 为用户增加经验（可为负，最低裁剪到 0），并同步更新等级。
func (svc *Service) AddExp(id int64, delta int) error {
	u, err := svc.Get(id)
	if err != nil {
		return err
	}
	exp := u.Exp + delta
	if exp < 0 {
		exp = 0
	}
	_, err = svc.s.DB.Exec(`UPDATE user SET exp=?, level=? WHERE id=?`, exp, LevelForExp(exp), id)
	return err
}

// ErrAuth 表示登录鉴权失败（账号不存在或密码错误）。
var ErrAuth = errors.New("auth failed")

// Bind 为用户绑定用户名与密码（密码以 bcrypt 哈希存储），用于游客升级为正式账号。
func (svc *Service) Bind(id int64, username, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = svc.s.DB.Exec(`UPDATE user SET username=?, password_hash=? WHERE id=?`, username, string(hash), id)
	return err
}

// Login 按用户名+密码登录，成功返回对应用户；任何失败均返回 ErrAuth（避免泄漏账号是否存在）。
func (svc *Service) Login(username, password string) (*User, error) {
	var id int64
	var hash string
	err := svc.s.DB.QueryRow(`SELECT id, password_hash FROM user WHERE username=?`, username).Scan(&id, &hash)
	if err != nil {
		return nil, ErrAuth
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return nil, ErrAuth
	}
	return svc.Get(id)
}

// AllowAiWinExp 判断当日 AI 胜场经验是否仍在配额内（防刷）。
// 每次调用在未超额时计数 +1 并返回 true，超额返回 false。
func (svc *Service) AllowAiWinExp(id int64, dailyCap int) bool {
	day := time.Now().Format("2006-01-02")
	svc.s.DB.Exec(`INSERT INTO exp_daily (uid, day, ai_wins) VALUES (?,?,0) ON CONFLICT(uid, day) DO NOTHING`, id, day)
	var wins int
	if err := svc.s.DB.QueryRow(`SELECT ai_wins FROM exp_daily WHERE uid=? AND day=?`, id, day).Scan(&wins); err != nil {
		return false
	}
	if wins >= dailyCap {
		return false
	}
	svc.s.DB.Exec(`UPDATE exp_daily SET ai_wins=ai_wins+1 WHERE uid=? AND day=?`, id, day)
	return true
}

// Count 返回用户总数（运营后台概览用）。
func (svc *Service) Count() (int, error) {
	var n int
	err := svc.s.DB.QueryRow(`SELECT COUNT(*) FROM user`).Scan(&n)
	return n, err
}

// CountSince 返回 created_at >= sinceRFC 的用户数（如今日新增）。
// sinceRFC 为可被数据库比较的时间字符串（RFC3339 或 "YYYY-MM-DD HH:MM:SS"）。
func (svc *Service) CountSince(sinceRFC string) (int, error) {
	var n int
	err := svc.s.DB.QueryRow(`SELECT COUNT(*) FROM user WHERE created_at >= ?`, sinceRFC).Scan(&n)
	return n, err
}

// Recent 返回最近注册的用户（按 id 倒序），供运营后台列表展示。
func (svc *Service) Recent(limit int) ([]User, error) {
	rows, err := svc.s.DB.Query(
		`SELECT id, guest_id, username, nickname, avatar, exp, level, rank_tier, rank_points FROM user ORDER BY id DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	// 预分配为空切片，保证 JSON 序列化为 [] 而非 null。
	users := []User{}
	for rows.Next() {
		var u User
		var username sql.NullString
		if err := rows.Scan(&u.ID, &u.GuestID, &username, &u.Nickname, &u.Avatar, &u.Exp, &u.Level, &u.RankTier, &u.RankPoints); err != nil {
			return nil, err
		}
		u.Username = username.String
		users = append(users, u)
	}
	return users, rows.Err()
}

// RankResult 是一次段位结算的结果（供响应/触发晋级动画）。
type RankResult struct {
	Tier     int  `json:"tier"`     // 结算后阶梯索引
	Points   int  `json:"points"`   // 结算后阶内积分
	Promoted bool `json:"promoted"` // 是否升阶
	Demoted  bool `json:"demoted"`  // 是否降阶
}

// SettleRank 结算一局的段位变化（胜 +10 / 负 -10）。
// 用事务「读改写」并在 mysql 上加 FOR UPDATE 行锁，保证同一用户并发结算的安全。
func (svc *Service) SettleRank(id int64, win bool) (RankResult, error) {
	delta := rank.LossDelta
	if win {
		delta = rank.WinDelta
	}
	tx, err := svc.s.DB.Begin()
	if err != nil {
		return RankResult{}, err
	}
	defer tx.Rollback()
	var tier, points int
	if err := tx.QueryRow(
		`SELECT rank_tier, rank_points FROM user WHERE id=?`+svc.s.LockClause(), id).
		Scan(&tier, &points); err != nil {
		return RankResult{}, err
	}
	nt, np, up, down := rank.Apply(tier, points, delta)
	if _, err := tx.Exec(`UPDATE user SET rank_tier=?, rank_points=? WHERE id=?`, nt, np, id); err != nil {
		return RankResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return RankResult{}, err
	}
	return RankResult{Tier: nt, Points: np, Promoted: up, Demoted: down}, nil
}
