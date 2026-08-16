package endgame

import (
	"fmt"
	"testing"

	"github.com/wzq/gomoku/internal/gomoku"
)

type funCand struct {
	name   string
	stones []Stone
}

func funRender(t *testing.T, name string, l Level) {
	g := gridFromStones(l.Stones)
	steps := l.MinSteps()
	line := l.HintLine()
	t.Logf("=== %s === steps=%d 线=%v 子数=%d", name, steps, line, len(l.Stones))
	var s string
	s += "    "
	for x := 0; x < 15; x++ {
		s += fmt.Sprintf("%2d", x)
	}
	s += "\n"
	for y := 0; y < 15; y++ {
		s += fmt.Sprintf("%2d ", y)
		for x := 0; x < 15; x++ {
			c := g[y][x]
			ch := "·"
			if c == gomoku.Black {
				ch = "●"
			} else if c == gomoku.White {
				ch = "○"
			}
			s += ch + " "
		}
		s += "\n"
	}
	t.Logf("\n%s", s)
}

func TestFunCands(t *testing.T) {
	cands := []funCand{
		// 十字 · 天元十字（5黑十字 + 6白四角）
		{"十字", []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {7, 8, gomoku.Black}, {6, 7, gomoku.Black}, {8, 7, gomoku.Black},
			{4, 4, gomoku.White}, {10, 10, gomoku.White}, {4, 10, gomoku.White}, {10, 4, gomoku.White}, {5, 11, gomoku.White}, {9, 11, gomoku.White},
		}},
		// X形 · 双斜交叉
		{"X形", []Stone{
			{7, 5, gomoku.Black}, {6, 6, gomoku.Black}, {8, 6, gomoku.Black}, {7, 7, gomoku.Black}, {6, 8, gomoku.Black}, {8, 8, gomoku.Black}, {7, 9, gomoku.Black},
			{5, 5, gomoku.White}, {9, 9, gomoku.White}, {5, 9, gomoku.White}, {9, 5, gomoku.White}, {4, 6, gomoku.White}, {10, 8, gomoku.White},
		}},
		// 环形 · 众星拱月
		{"环形", []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {7, 8, gomoku.Black}, {6, 7, gomoku.Black}, {8, 7, gomoku.Black},
			{6, 6, gomoku.White}, {8, 8, gomoku.White}, {6, 8, gomoku.White}, {8, 6, gomoku.White},
			{5, 5, gomoku.White}, {9, 9, gomoku.White}, {5, 9, gomoku.White}, {9, 5, gomoku.White},
		}},
		// 双斜 · 左右开弓
		{"双斜", []Stone{
			{4, 4, gomoku.Black}, {5, 5, gomoku.Black}, {6, 6, gomoku.Black}, {8, 8, gomoku.Black}, {9, 9, gomoku.Black}, {10, 10, gomoku.Black},
			{4, 10, gomoku.White}, {5, 9, gomoku.White}, {6, 8, gomoku.White}, {8, 6, gomoku.White}, {9, 5, gomoku.White}, {10, 4, gomoku.White},
			{7, 7, gomoku.White},
		}},
		// 井字 · 四角连心
		{"井字", []Stone{
			{6, 6, gomoku.Black}, {7, 6, gomoku.Black}, {8, 6, gomoku.Black}, {6, 8, gomoku.Black}, {7, 8, gomoku.Black}, {8, 8, gomoku.Black},
			{6, 5, gomoku.White}, {8, 5, gomoku.White}, {5, 6, gomoku.White}, {5, 8, gomoku.White}, {9, 6, gomoku.White}, {9, 8, gomoku.White}, {7, 7, gomoku.White},
		}},
	}
	for _, c := range cands {
		l := Level{Stones: c.stones, ToMove: gomoku.Black}
		funRender(t, c.name, l)
	}
}
