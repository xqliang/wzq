package room

import "testing"

func TestHubCreateAndJoin(t *testing.T) {
	h := NewHub()
	id := h.Create(1)
	if id == "" {
		t.Fatal("empty room id")
	}
	r, ok := h.Get(id)
	if !ok {
		t.Fatal("room not found")
	}
	if err := r.addPlayer(1); err != nil {
		t.Fatal(err)
	}
	if err := r.addPlayer(2); err != nil {
		t.Fatal(err)
	}
	if err := r.addPlayer(3); err == nil {
		t.Fatal("third player should be rejected")
	}
}
