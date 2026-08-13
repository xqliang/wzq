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

// Levels 是全部预置关卡。均为执黑必胜残局，通过守卫测试验证「6-12 子、无既成五连、
// 存在 1-5 步必胜」。每关由核心杀型 + 远角孤立点缀子构成，看起来像真实中局。
var Levels = []Level{
	// 第一章「一步致胜」：已有活四/跳四，一手连五。
	{
		ID: "1-1", Chapter: 1, Name: "一步致胜", Difficulty: 1, ToMove: gomoku.Black,
		Stones: []Stone{
			{3, 7, gomoku.Black}, {4, 7, gomoku.Black}, {5, 7, gomoku.Black}, {6, 7, gomoku.Black},
			{0, 13, gomoku.Black},
			{0, 0, gomoku.White}, {14, 0, gomoku.White}, {13, 13, gomoku.White},
		},
	},
	{
		ID: "1-2", Chapter: 1, Name: "一步致胜", Difficulty: 1, ToMove: gomoku.Black,
		Stones: []Stone{
			{5, 3, gomoku.Black}, {6, 3, gomoku.Black}, {7, 3, gomoku.Black}, {9, 3, gomoku.Black},
			{1, 12, gomoku.Black},
			{0, 0, gomoku.White}, {14, 1, gomoku.White}, {12, 13, gomoku.White},
		},
	},
	// 第二章「两步杀」：活三，一手成活四，对手只能堵一端，另一端连五。
	{
		ID: "2-1", Chapter: 2, Name: "两步杀", Difficulty: 3, ToMove: gomoku.Black,
		Stones: []Stone{
			{6, 7, gomoku.Black}, {7, 7, gomoku.Black}, {8, 7, gomoku.Black},
			{1, 1, gomoku.Black}, {13, 12, gomoku.Black},
			{0, 13, gomoku.White}, {14, 0, gomoku.White}, {2, 12, gomoku.White}, {12, 2, gomoku.White},
		},
	},
	{
		ID: "2-2", Chapter: 2, Name: "两步杀", Difficulty: 3, ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 5, gomoku.Black}, {7, 6, gomoku.Black}, {7, 7, gomoku.Black},
			{1, 12, gomoku.Black}, {13, 1, gomoku.Black},
			{0, 0, gomoku.White}, {14, 14, gomoku.White}, {2, 2, gomoku.White}, {12, 12, gomoku.White},
		},
	},
	// 第三章「四三杀」：一手同时成冲四 + 活三，对手堵四后活三再成活四取胜（三步）。
	{
		ID: "3-1", Chapter: 3, Name: "四三杀", Difficulty: 5, ToMove: gomoku.Black,
		Stones: []Stone{
			{4, 7, gomoku.Black}, {5, 7, gomoku.Black}, {6, 7, gomoku.Black}, // 横三，左端被堵
			{7, 8, gomoku.Black}, {7, 9, gomoku.Black}, // 竖二
			{3, 7, gomoku.White}, // 堵住横三左端
			{0, 0, gomoku.White}, {14, 14, gomoku.White},
			{0, 14, gomoku.Black},
		},
	},
	{
		ID: "3-2", Chapter: 3, Name: "四三杀", Difficulty: 5, ToMove: gomoku.Black,
		Stones: []Stone{
			{5, 5, gomoku.Black}, {6, 6, gomoku.Black}, {7, 7, gomoku.Black}, // 主对角三，右下端被堵
			{5, 4, gomoku.Black}, {6, 4, gomoku.Black}, // 横二（y=4）
			{8, 8, gomoku.White}, // 堵住对角右下端
			{0, 0, gomoku.White}, {14, 0, gomoku.White},
			{0, 14, gomoku.Black},
		},
	},
}
