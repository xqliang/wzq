// Package main 是五子棋服务端入口：加载配置、初始化数据层与各服务、启动 HTTP 服务。
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/wzq/gomoku/internal/api"
	"github.com/wzq/gomoku/internal/auth"
	"github.com/wzq/gomoku/internal/config"
	"github.com/wzq/gomoku/internal/endgame"
	"github.com/wzq/gomoku/internal/record"
	"github.com/wzq/gomoku/internal/room"
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
		DailyAiWinCap: 20,
		WebDir:        cfg.Web.Dir,
		AdminPassword: cfg.Admin.Password,
	}
	// 对局结束回调：结算真人对战经验并落库战绩。
	srv.Hub.SetOnGameOver(srv.SettlePvP)
	log.Printf("listening %s", cfg.Addr)
	log.Fatal(http.ListenAndServe(cfg.Addr, srv.Routes()))
}
