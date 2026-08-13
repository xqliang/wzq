// Package auth 提供 HS256 JWT 的签发与校验（sub=userID）。
package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var ErrInvalidToken = errors.New("invalid token")

type Manager struct {
	secret  []byte
	authTTL time.Duration
}

func NewManager(secret string, ttlMinutes int) *Manager {
	return &Manager{secret: []byte(secret), authTTL: time.Duration(ttlMinutes) * time.Minute}
}

func (m *Manager) Issue(userID string) (string, error) {
	now := time.Now()
	c := jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(m.authTTL)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(m.secret)
}

func (m *Manager) Verify(token string) (string, error) {
	var c jwt.RegisteredClaims
	t, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return m.secret, nil
	})
	if err != nil || !t.Valid {
		return "", ErrInvalidToken
	}
	return c.Subject, nil
}
