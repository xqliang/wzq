package auth

import "testing"

func TestSignAndVerify(t *testing.T) {
	m := NewManager("secret", 60)
	tok, err := m.Issue("42")
	if err != nil {
		t.Fatal(err)
	}
	uid, err := m.Verify(tok)
	if err != nil {
		t.Fatal(err)
	}
	if uid != "42" {
		t.Fatalf("uid=%q", uid)
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	m := NewManager("secret", 60)
	if _, err := m.Verify("not.a.token"); err == nil {
		t.Fatal("expected error")
	}
}
