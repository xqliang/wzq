// Package main 是五子棋服务端入口：加载配置、初始化数据层与各服务、启动 HTTP 服务。
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/wzq/gomoku/internal/api"
	"github.com/wzq/gomoku/internal/auth"
	"github.com/wzq/gomoku/internal/config"
	"github.com/wzq/gomoku/internal/daily"
	"github.com/wzq/gomoku/internal/endgame"
	"github.com/wzq/gomoku/internal/record"
	"github.com/wzq/gomoku/internal/room"
	"github.com/wzq/gomoku/internal/shop"
	"github.com/wzq/gomoku/internal/store"
	"github.com/wzq/gomoku/internal/user"
)

func main() {
	cfg, err := config.Load("config.yaml")
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	// 确保 sqlite 数据目录存在。
	if err := os.MkdirAll("data", 0755); err != nil {
		log.Fatalf("mkdir data: %v", err)
	}
	st, err := store.Open(cfg.DB.Driver, cfg.DB.DSN)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	if err := st.Migrate(); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	userSvc := user.New(st)
	srv := &api.Server{
		Users:         userSvc,
		Auth:          auth.NewManager(cfg.Auth.Secret, cfg.Auth.AuthTTLMinutes),
		Hub:           room.NewHub(),
		Records:       record.New(st),
		Endgame:       endgame.New(st, userSvc),
		Shop:          shop.New(st),
		Daily:         daily.New(st),
		DailyAiWinCap: 20,
		WebDir:        cfg.Web.Dir,
		AdminPassword: cfg.Admin.Password,
	}
	// 对局结束回调：结算真人对战经验并落库战绩。
	srv.Hub.SetOnGameOver(srv.SettlePvP)
	// 玩家资料查询：开局时给每位玩家下发对手真实段位/头像/头像框/落子特效。
	srv.Hub.SetPlayerMeta(func(uid int64) room.PlayerMeta {
		u, err := srv.Users.Get(uid)
		if err != nil {
			return room.PlayerMeta{}
		}
		return room.PlayerMeta{Tier: u.RankTier, Avatar: u.Avatar, Frame: u.EquippedFrame, Effect: u.EquippedEffect}
	})
	log.Printf("listening %s", cfg.Addr)
	log.Fatal(http.ListenAndServe(cfg.Addr, srv.Routes()))
}
