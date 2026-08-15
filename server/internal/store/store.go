// Package store 管理数据库连接与建表迁移，兼容 sqlite（本地）与 mysql（线上）。
package store

import (
	"database/sql"

	_ "github.com/go-sql-driver/mysql"
	_ "modernc.org/sqlite"
)

// Store 封装底层数据库连接与所用驱动名称。
type Store struct {
	DB     *sql.DB
	driver string
}

// Open 根据驱动名打开数据库连接并校验连通性。
// driver 支持 "sqlite" 与 "mysql"；sqlite 由 modernc.org/sqlite 以 "sqlite" 名注册。
func Open(driver, dsn string) (*Store, error) {
	name := driver
	if driver == "sqlite" {
		name = "sqlite"
	}
	db, err := sql.Open(name, dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return &Store{DB: db, driver: driver}, nil
}

// Close 关闭底层数据库连接。
func (s *Store) Close() error { return s.DB.Close() }

// autoInc 返回自增主键的列定义，兼容 mysql 与 sqlite 的语法差异。
func (s *Store) autoInc() string {
	if s.driver == "mysql" {
		return "BIGINT PRIMARY KEY AUTO_INCREMENT"
	}
	return "INTEGER PRIMARY KEY AUTOINCREMENT"
}

// Migrate 建表（幂等）：用户、对局记录、落子记录、每日经验计数。
func (s *Store) Migrate() error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS user (
			id ` + s.autoInc() + `,
			guest_id VARCHAR(64) UNIQUE,
			username VARCHAR(64) UNIQUE,
			password_hash VARCHAR(128),
			nickname VARCHAR(64),
			avatar VARCHAR(128),
			exp INT NOT NULL DEFAULT 0,
			level INT NOT NULL DEFAULT 1,
			rank_tier INT NOT NULL DEFAULT 0,
			rank_points INT NOT NULL DEFAULT 0,
			created_at DATETIME,
			last_login DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS game_record (
			id ` + s.autoInc() + `,
			mode VARCHAR(8), ai_level INT, black_uid BIGINT, white_uid BIGINT,
			winner VARCHAR(8), moves INT, duration INT, end_reason VARCHAR(16), created_at DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS game_move (
			id ` + s.autoInc() + `,
			game_id BIGINT, seq INT, color VARCHAR(8), x INT, y INT, ts DATETIME
		)`,
		`CREATE TABLE IF NOT EXISTS exp_daily (
			uid BIGINT, day VARCHAR(10), ai_wins INT NOT NULL DEFAULT 0, PRIMARY KEY (uid, day)
		)`,
		`CREATE TABLE IF NOT EXISTS endgame_progress (
			uid BIGINT, level_id VARCHAR(16), passed INT NOT NULL DEFAULT 0,
			attempts INT NOT NULL DEFAULT 0, hints INT NOT NULL DEFAULT 0,
			PRIMARY KEY (uid, level_id)
		)`,
	}
	for _, q := range stmts {
		if _, err := s.DB.Exec(q); err != nil {
			return err
		}
	}
	// 存量库补列（CREATE IF NOT EXISTS 不会给老表加列）：段位阶与阶内积分。幂等。
	if err := s.addColumnIfMissing("user", "rank_tier", "INT NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := s.addColumnIfMissing("user", "rank_points", "INT NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	return nil
}

// LockClause 返回行级排他锁子句，用于「读改写」结算的并发安全。
// mysql 支持 SELECT ... FOR UPDATE；sqlite 单写者串行，返回空串即可。
func (s *Store) LockClause() string {
	if s.driver == "mysql" {
		return " FOR UPDATE"
	}
	return ""
}

// hasColumn 判断表是否已有某列（兼容 mysql information_schema 与 sqlite PRAGMA）。
func (s *Store) hasColumn(table, col string) bool {
	if s.driver == "mysql" {
		var n int
		s.DB.QueryRow(
			`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?`,
			table, col).Scan(&n)
		return n > 0
	}
	rows, err := s.DB.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return false
	}
	defer rows.Close()
	for rows.Next() {
		var cid, notnull, pk int
		var name, ctype string
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false
		}
		if name == col {
			return true
		}
	}
	return false
}

// addColumnIfMissing 在列不存在时 ALTER TABLE 增加列；已存在则跳过。幂等，兼容两种驱动。
func (s *Store) addColumnIfMissing(table, col, def string) error {
	if s.hasColumn(table, col) {
		return nil
	}
	_, err := s.DB.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + col + ` ` + def)
	return err
}
