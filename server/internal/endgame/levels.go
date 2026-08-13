// Package endgame 提供「残局闯关」能力：预置关卡为真正意义的必胜残局
// （执黑可在若干步内连续冲四逼死对手），可接受落子由解算器(solver.go)推导。
package endgame

import "github.com/wzq/gomoku/internal/gomoku"

// Stone 表示关卡初始局面中的一枚棋子。
type Stone struct {
	X     int          `json:"x"`
	Y     int          `json:"y"`
	Color gomoku.Color `json:"color"`
}

// Level 描述一个残局关卡：给定局面，执 ToMove 方可在数步内必胜。
type Level struct {
	ID         string
	Chapter    int
	Name       string
	Difficulty int // 星级 1-6
	Stones     []Stone
	ToMove     gomoku.Color
}

// other 返回对手方颜色。
func other(c gomoku.Color) gomoku.Color {
	if c == gomoku.Black {
		return gomoku.White
	}
	return gomoku.Black
}

// AcceptedAnswers 用解算器推导本关可导向必胜的首着集合（5 步以内）。
func (l Level) AcceptedAnswers() [][2]int {
	g := gridFromStones(l.Stones)
	return solveFirstMoves(&g, l.ToMove, 5)
}

// MinSteps 返回本关最小必胜步数（5 步以内）；0 表示无解。
func (l Level) MinSteps() int {
	g := gridFromStones(l.Stones)
	return minMateDepth(&g, l.ToMove, 5)
}

// Levels 是全部预置关卡：均为「执黑走多步必胜」的真实中局残局，由生成器
// （generate_test.go 的 TestGenerateLevels，GEN=1 时运行）模拟拟真短对局后，
// 用解算器筛选出「黑方 2..5 步连续冲四(VCF)必胜」的自然聚拢局面，去重后收录。
// 每关均通过守卫测试（levels_test.go）：8..24 子、无既成五连、最小必胜步数 2..5。
// 按难度（=必胜步数）升序排列，Chapter = 必胜步数-1，Difficulty = 必胜步数。
// 关卡命名：2→活三杀，3→四三杀，4→连环杀，5→胜势残局。
var Levels = []Level{
	// —— 第一章 · 活三杀（黑方 2 步必胜）——
	{
		ID: "1-1", Chapter: 1, Name: "活三杀", Difficulty: 2, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {6, 5, gomoku.Black}, {5, 6, gomoku.Black}, {4, 7, gomoku.Black},
			{6, 6, gomoku.White}, {7, 6, gomoku.White}, {5, 7, gomoku.White}, {4, 5, gomoku.White},
		},
	},
	{
		ID: "1-2", Chapter: 1, Name: "活三杀", Difficulty: 2, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {6, 7, gomoku.Black}, {7, 5, gomoku.Black},
			{6, 6, gomoku.White}, {6, 8, gomoku.White}, {5, 7, gomoku.White}, {7, 9, gomoku.White},
		},
	},
	{
		ID: "1-3", Chapter: 1, Name: "活三杀", Difficulty: 2, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {6, 6, gomoku.Black}, {8, 6, gomoku.Black}, {7, 6, gomoku.Black},
			{8, 7, gomoku.White}, {8, 8, gomoku.White}, {8, 9, gomoku.White}, {6, 8, gomoku.White},
		},
	},
	{
		ID: "1-4", Chapter: 1, Name: "活三杀", Difficulty: 2, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {5, 5, gomoku.Black}, {6, 4, gomoku.Black}, {4, 6, gomoku.Black},
			{6, 6, gomoku.White}, {6, 5, gomoku.White}, {5, 6, gomoku.White}, {8, 7, gomoku.White},
		},
	},
	// —— 第二章 · 四三杀（黑方 3 步必胜）——
	{
		ID: "2-1", Chapter: 2, Name: "四三杀", Difficulty: 3, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {7, 8, gomoku.Black}, {6, 8, gomoku.Black}, {5, 7, gomoku.Black},
			{6, 6, gomoku.White}, {7, 5, gomoku.White}, {6, 7, gomoku.White}, {5, 6, gomoku.White}, {8, 8, gomoku.White},
		},
	},
	{
		ID: "2-2", Chapter: 2, Name: "四三杀", Difficulty: 3, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {7, 5, gomoku.Black}, {6, 7, gomoku.Black}, {5, 6, gomoku.Black},
			{6, 6, gomoku.White}, {5, 7, gomoku.White}, {7, 4, gomoku.White}, {6, 3, gomoku.White}, {5, 2, gomoku.White},
		},
	},
	{
		ID: "2-3", Chapter: 2, Name: "四三杀", Difficulty: 3, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {7, 5, gomoku.Black}, {6, 5, gomoku.Black}, {8, 7, gomoku.Black}, {9, 6, gomoku.Black},
			{6, 6, gomoku.White}, {5, 7, gomoku.White}, {7, 4, gomoku.White}, {8, 5, gomoku.White}, {5, 4, gomoku.White}, {9, 4, gomoku.White},
		},
	},
	{
		ID: "2-4", Chapter: 2, Name: "四三杀", Difficulty: 3, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {7, 5, gomoku.Black}, {6, 7, gomoku.Black}, {5, 6, gomoku.Black}, {8, 5, gomoku.Black},
			{6, 6, gomoku.White}, {5, 7, gomoku.White}, {7, 4, gomoku.White}, {6, 3, gomoku.White}, {5, 2, gomoku.White}, {9, 4, gomoku.White},
		},
	},
	// —— 第三章 · 连环杀（黑方 4 步必胜）——
	{
		ID: "3-1", Chapter: 3, Name: "连环杀", Difficulty: 4, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {5, 6, gomoku.Black}, {5, 7, gomoku.Black}, {5, 8, gomoku.Black}, {6, 7, gomoku.Black},
			{6, 6, gomoku.White}, {7, 5, gomoku.White}, {4, 7, gomoku.White}, {8, 6, gomoku.White}, {5, 9, gomoku.White}, {8, 5, gomoku.White},
		},
	},
	{
		ID: "3-2", Chapter: 3, Name: "连环杀", Difficulty: 4, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {7, 5, gomoku.Black}, {6, 7, gomoku.Black}, {8, 9, gomoku.Black}, {8, 7, gomoku.Black}, {6, 5, gomoku.Black},
			{6, 6, gomoku.White}, {8, 8, gomoku.White}, {7, 8, gomoku.White}, {8, 4, gomoku.White}, {8, 5, gomoku.White}, {9, 8, gomoku.White}, {9, 7, gomoku.White},
		},
	},
	{
		ID: "3-3", Chapter: 3, Name: "连环杀", Difficulty: 4, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {6, 7, gomoku.Black}, {5, 7, gomoku.Black}, {5, 8, gomoku.Black}, {8, 4, gomoku.Black}, {9, 5, gomoku.Black}, {7, 8, gomoku.Black},
			{6, 6, gomoku.White}, {7, 5, gomoku.White}, {6, 8, gomoku.White}, {8, 7, gomoku.White}, {8, 5, gomoku.White}, {5, 9, gomoku.White}, {9, 6, gomoku.White}, {7, 4, gomoku.White},
		},
	},
	// —— 第四章 · 胜势残局（黑方 5 步必胜）——
	{
		ID: "4-1", Chapter: 4, Name: "胜势残局", Difficulty: 5, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {8, 4, gomoku.Black}, {8, 5, gomoku.Black}, {9, 4, gomoku.Black}, {8, 3, gomoku.Black}, {7, 4, gomoku.Black},
			{6, 6, gomoku.White}, {7, 5, gomoku.White}, {9, 5, gomoku.White}, {5, 7, gomoku.White}, {6, 7, gomoku.White}, {8, 6, gomoku.White}, {6, 4, gomoku.White},
		},
	},
	{
		ID: "4-2", Chapter: 4, Name: "胜势残局", Difficulty: 5, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 7, gomoku.Black}, {7, 6, gomoku.Black}, {6, 7, gomoku.Black}, {9, 8, gomoku.Black}, {6, 8, gomoku.Black}, {5, 8, gomoku.Black}, {4, 8, gomoku.Black}, {9, 7, gomoku.Black}, {6, 9, gomoku.Black},
			{6, 6, gomoku.White}, {7, 5, gomoku.White}, {8, 7, gomoku.White}, {5, 7, gomoku.White}, {10, 8, gomoku.White}, {8, 5, gomoku.White}, {7, 8, gomoku.White}, {9, 6, gomoku.White}, {8, 9, gomoku.White},
		},
	},
}
