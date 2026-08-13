// Package user 管理用户、经验与等级。
package user

import (
	"database/sql"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/wzq/gomoku/internal/store"
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
		`SELECT id, guest_id, username, nickname, avatar, exp, level FROM user WHERE id=?`, id).
		Scan(&u.ID, &u.GuestID, &username, &u.Nickname, &u.Avatar, &u.Exp, &u.Level)
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
