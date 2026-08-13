package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDefaultsAndYAML(t *testing.T) {
	dir := t.TempDir()
	p := filepath.Join(dir, "config.yaml")
	os.WriteFile(p, []byte("addr: \":9090\"\ndb:\n  driver: sqlite\n  dsn: data/x.db\n"), 0o644)
	cfg, err := Load(p)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr != ":9090" {
		t.Fatalf("addr=%q", cfg.Addr)
	}
	if cfg.Auth.AuthTTLMinutes == 0 {
		t.Fatal("auth ttl default not applied")
	}
}

func TestEnvOverridesSecret(t *testing.T) {
	t.Setenv("WZQ_AUTH_SECRET", "s3cr3t")
	cfg, err := Load(filepath.Join(t.TempDir(), "missing.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Auth.Secret != "s3cr3t" {
		t.Fatalf("secret=%q", cfg.Auth.Secret)
	}
}

func TestAdminPasswordDefaultAndEnv(t *testing.T) {
	// 默认口令：无配置无环境变量时应用内置默认值。
	cfg, err := Load(filepath.Join(t.TempDir(), "missing.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Admin.Password != "wzq-admin-888" {
		t.Fatalf("default admin password=%q", cfg.Admin.Password)
	}
	// 环境变量覆盖。
	t.Setenv("WZQ_ADMIN_PASSWORD", "override-pw")
	cfg2, err := Load(filepath.Join(t.TempDir(), "missing.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	if cfg2.Admin.Password != "override-pw" {
		t.Fatalf("env admin password=%q", cfg2.Admin.Password)
	}
}
