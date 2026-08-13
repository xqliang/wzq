// Package config 加载服务端配置：默认值 < config.yaml < 环境变量。
package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type DB struct {
	Driver string `yaml:"driver"`
	DSN    string `yaml:"dsn"`
}

type Auth struct {
	Secret         string `yaml:"-"`
	AuthTTLMinutes int    `yaml:"authTtlMinutes"`
}

// Web 前端静态资源配置：WebDir 为构建产物目录，空则不托管前端（仅 API）。
type Web struct {
	Dir string `yaml:"dir"`
}

// Admin 运营后台配置：Password 为后台登录口令。
type Admin struct {
	Password string `yaml:"password"`
}

type Config struct {
	Addr  string `yaml:"addr"`
	DB    DB     `yaml:"db"`
	Auth  Auth   `yaml:"auth"`
	Web   Web    `yaml:"web"`
	Admin Admin  `yaml:"admin"`
}

func Load(path string) (*Config, error) {
	cfg := &Config{
		Addr: ":8090",
		DB:   DB{Driver: "sqlite", DSN: "data/app.db"},
		Auth: Auth{AuthTTLMinutes: 43200},
	}
	if data, err := os.ReadFile(path); err == nil {
		if err := yaml.Unmarshal(data, cfg); err != nil {
			return nil, err
		}
	}
	if v := os.Getenv("WZQ_AUTH_SECRET"); v != "" {
		cfg.Auth.Secret = v
	}
	if cfg.Auth.Secret == "" {
		cfg.Auth.Secret = "dev-insecure-secret"
	}
	if v := os.Getenv("WZQ_DB_DSN"); v != "" {
		cfg.DB.DSN = v
	}
	if v := os.Getenv("WZQ_DB_DRIVER"); v != "" {
		cfg.DB.Driver = v
	}
	if v := os.Getenv("WZQ_WEB_DIR"); v != "" {
		cfg.Web.Dir = v
	}
	// 运营后台口令：默认值兼容既有线上无需改配置；可用环境变量覆盖。
	if cfg.Admin.Password == "" {
		cfg.Admin.Password = "wzq-admin-888"
	}
	if v := os.Getenv("WZQ_ADMIN_PASSWORD"); v != "" {
		cfg.Admin.Password = v
	}
	return cfg, nil
}
