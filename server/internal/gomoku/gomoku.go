// Package gomoku 是服务端权威棋规：落子合法性 + 五连判定，供房间裁判使用。
package gomoku

import "errors"

const Size = 15

type Color string

const (
	Black Color = "black"
	White Color = "white"
)

var ErrIllegal = errors.New("illegal move")

type Board struct {
	cells [Size][Size]Color
}

func NewBoard() *Board { return &Board{} }

func inRange(x, y int) bool { return x >= 0 && y >= 0 && x < Size && y < Size }

func (b *Board) At(x, y int) Color {
	if !inRange(x, y) {
		return ""
	}
	return b.cells[y][x]
}

func (b *Board) Apply(x, y int, c Color) error {
	if !inRange(x, y) || b.cells[y][x] != "" {
		return ErrIllegal
	}
	b.cells[y][x] = c
	return nil
}

var dirs = [4][2]int{{1, 0}, {0, 1}, {1, 1}, {1, -1}}

func (b *Board) CheckWin(x, y int) Color {
	c := b.At(x, y)
	if c == "" {
		return ""
	}
	for _, d := range dirs {
		count := 1
		for _, sign := range [2]int{1, -1} {
			nx, ny := x+d[0]*sign, y+d[1]*sign
			for inRange(nx, ny) && b.cells[ny][nx] == c {
				count++
				nx += d[0] * sign
				ny += d[1] * sign
			}
		}
		if count >= 5 {
			return c
		}
	}
	return ""
}
