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

type Config struct {
	Addr string `yaml:"addr"`
	DB   DB     `yaml:"db"`
	Auth Auth   `yaml:"auth"`
}

func Load(path string) (*Config, error) {
	cfg := &Config{
		Addr: ":8080",
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
	return cfg, nil
}
