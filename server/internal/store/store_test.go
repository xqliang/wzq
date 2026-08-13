package store

import "testing"

func TestOpenSqliteAndMigrate(t *testing.T) {
	s, err := Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err := s.Migrate(); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM user").Scan(&n); err != nil {
		t.Fatalf("user table missing: %v", err)
	}
}
