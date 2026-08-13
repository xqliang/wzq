// Package endgame 提供「残局闯关」能力：预置关卡、用棋规自推导可接受落子、进度与经验记录。
package endgame

import "github.com/wzq/gomoku/internal/gomoku"

// Stone 表示关卡初始局面中的一枚棋子。
type Stone struct {
	X     int          `json:"x"`
	Y     int          `json:"y"`
	Color gomoku.Color `json:"color"`
}

// Level 描述一个残局关卡。
// Kind 为 "win1"（执子方一步取胜）或 "block1"（对手下一步能赢，执子方必须挡掉其立即取胜点）。
type Level struct {
	ID         string
	Chapter    int
	Name       string
	Difficulty int // 星级 1-6
	Stones     []Stone
	ToMove     gomoku.Color
	Kind       string // "win1" | "block1"
}

// Levels 是全部预置关卡（每关 6-12 子的中局局面，答案均由棋规自动推导、经守卫测试验证）。
// 每关由「关键威胁线」+ 若干远离答案点的点缀子构成，看起来更像真实对局。
var Levels = []Level{
	// 第一章「入门·连五」：执黑一步连五（活四两端皆可）。
	{
		ID: "1-1", Chapter: 1, Name: "入门·连五", Difficulty: 1, Kind: "win1", ToMove: gomoku.Black,
		Stones: []Stone{
			{3, 7, gomoku.Black}, {4, 7, gomoku.Black}, {5, 7, gomoku.Black}, {6, 7, gomoku.Black},
			{10, 10, gomoku.Black}, {1, 1, gomoku.Black},
			{4, 8, gomoku.White}, {5, 9, gomoku.White}, {9, 3, gomoku.White}, {11, 11, gomoku.White},
		},
	},
	{
		ID: "1-2", Chapter: 1, Name: "入门·连五", Difficulty: 1, Kind: "win1", ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 3, gomoku.Black}, {7, 4, gomoku.Black}, {7, 5, gomoku.Black}, {7, 6, gomoku.Black},
			{2, 11, gomoku.Black}, {12, 2, gomoku.Black},
			{6, 4, gomoku.White}, {8, 5, gomoku.White}, {3, 3, gomoku.White}, {11, 11, gomoku.White},
		},
	},
	{
		ID: "1-3", Chapter: 1, Name: "入门·连五", Difficulty: 2, Kind: "win1", ToMove: gomoku.Black,
		Stones: []Stone{
			{3, 3, gomoku.Black}, {4, 4, gomoku.Black}, {5, 5, gomoku.Black}, {6, 6, gomoku.Black},
			{11, 3, gomoku.Black}, {2, 12, gomoku.Black},
			{4, 3, gomoku.White}, {6, 5, gomoku.White}, {9, 9, gomoku.White}, {1, 7, gomoku.White},
		},
	},
	{
		ID: "1-4", Chapter: 1, Name: "入门·连五", Difficulty: 2, Kind: "win1", ToMove: gomoku.Black,
		Stones: []Stone{
			{2, 2, gomoku.Black}, {2, 3, gomoku.Black}, {2, 4, gomoku.Black}, {2, 5, gomoku.Black},
			{10, 10, gomoku.Black}, {12, 4, gomoku.Black},
			{3, 3, gomoku.White}, {1, 4, gomoku.White}, {3, 5, gomoku.White}, {8, 8, gomoku.White},
		},
	},
	{
		ID: "1-5", Chapter: 1, Name: "入门·连五", Difficulty: 2, Kind: "win1", ToMove: gomoku.Black,
		Stones: []Stone{
			{9, 9, gomoku.Black}, {10, 9, gomoku.Black}, {11, 9, gomoku.Black}, {12, 9, gomoku.Black},
			{2, 2, gomoku.Black}, {5, 6, gomoku.Black},
			{9, 8, gomoku.White}, {11, 10, gomoku.White}, {4, 12, gomoku.White}, {13, 10, gomoku.White},
		},
	},
	// 第二章「进阶·挡杀」：白已成四且一端被堵，唯一挡点。
	{
		ID: "2-1", Chapter: 2, Name: "进阶·挡杀", Difficulty: 3, Kind: "block1", ToMove: gomoku.Black,
		Stones: []Stone{
			{4, 7, gomoku.White}, {5, 7, gomoku.White}, {6, 7, gomoku.White}, {7, 7, gomoku.White},
			{2, 11, gomoku.White}, {12, 1, gomoku.White}, {0, 0, gomoku.White},
			{3, 7, gomoku.Black}, {5, 5, gomoku.Black}, {6, 9, gomoku.Black}, {10, 3, gomoku.Black},
		},
	},
	{
		ID: "2-2", Chapter: 2, Name: "进阶·挡杀", Difficulty: 3, Kind: "block1", ToMove: gomoku.Black,
		Stones: []Stone{
			{7, 4, gomoku.White}, {7, 5, gomoku.White}, {7, 6, gomoku.White}, {7, 7, gomoku.White},
			{11, 11, gomoku.White}, {1, 9, gomoku.White}, {13, 2, gomoku.White},
			{7, 3, gomoku.Black}, {6, 5, gomoku.Black}, {8, 6, gomoku.Black}, {2, 2, gomoku.Black},
		},
	},
	{
		ID: "2-3", Chapter: 2, Name: "进阶·挡杀", Difficulty: 4, Kind: "block1", ToMove: gomoku.Black,
		Stones: []Stone{
			{5, 5, gomoku.White}, {6, 6, gomoku.White}, {7, 7, gomoku.White}, {8, 8, gomoku.White},
			{12, 2, gomoku.White}, {1, 1, gomoku.White}, {3, 12, gomoku.White},
			{4, 4, gomoku.Black}, {6, 5, gomoku.Black}, {7, 6, gomoku.Black}, {2, 10, gomoku.Black},
		},
	},
	{
		ID: "2-4", Chapter: 2, Name: "进阶·挡杀", Difficulty: 4, Kind: "block1", ToMove: gomoku.Black,
		Stones: []Stone{
			{2, 10, gomoku.White}, {3, 10, gomoku.White}, {4, 10, gomoku.White}, {5, 10, gomoku.White},
			{12, 12, gomoku.White}, {8, 1, gomoku.White}, {0, 5, gomoku.White},
			{6, 10, gomoku.Black}, {3, 9, gomoku.Black}, {4, 11, gomoku.Black}, {9, 3, gomoku.Black},
		},
	},
	// 第三章「高手·连五」：跳四/断点，唯一补点成五。
	{
		ID: "3-1", Chapter: 3, Name: "高手·连五", Difficulty: 5, Kind: "win1", ToMove: gomoku.Black,
		Stones: []Stone{
			{5, 7, gomoku.Black}, {6, 7, gomoku.Black}, {8, 7, gomoku.Black}, {9, 7, gomoku.Black},
			{11, 11, gomoku.Black}, {1, 5, gomoku.Black},
			{6, 8, gomoku.White}, {8, 6, gomoku.White}, {2, 2, gomoku.White}, {12, 3, gomoku.White},
		},
	},
	{
		ID: "3-2", Chapter: 3, Name: "高手·连五", Difficulty: 5, Kind: "win1", ToMove: gomoku.Black,
		Stones: []Stone{
			{5, 3, gomoku.Black}, {6, 3, gomoku.Black}, {7, 3, gomoku.Black}, {9, 3, gomoku.Black},
			{2, 10, gomoku.Black}, {12, 12, gomoku.Black},
			{5, 2, gomoku.White}, {7, 4, gomoku.White}, {11, 9, gomoku.White}, {1, 1, gomoku.White},
		},
	},
	{
		ID: "3-3", Chapter: 3, Name: "高手·连五", Difficulty: 6, Kind: "win1", ToMove: gomoku.Black,
		Stones: []Stone{
			{3, 5, gomoku.Black}, {4, 6, gomoku.Black}, {6, 8, gomoku.Black}, {7, 9, gomoku.Black},
			{1, 1, gomoku.Black}, {12, 12, gomoku.Black},
			{4, 5, gomoku.White}, {6, 7, gomoku.White}, {10, 2, gomoku.White}, {2, 12, gomoku.White},
		},
	},
}

// other 返回对手方颜色。
func other(c gomoku.Color) gomoku.Color {
	if c == gomoku.Black {
		return gomoku.White
	}
	return gomoku.Black
}

// buildBoard 依据关卡初始棋子重建一块全新棋盘（避免试算时污染共享状态）。
func (l Level) buildBoard() *gomoku.Board {
	b := gomoku.NewBoard()
	for _, st := range l.Stones {
		b.Apply(st.X, st.Y, st.Color)
	}
	return b
}

// AcceptedAnswers 用棋规从局面推导本关可接受的落子集合。
//   - win1：所有空点 c，执子方落 c 后即成五连。
//   - block1：所有空点 c，执子方落 c 后，对手已无任何空点 d 可以立即连五。
func (l Level) AcceptedAnswers() [][2]int {
	var out [][2]int
	opp := other(l.ToMove)
	for y := 0; y < gomoku.Size; y++ {
		for x := 0; x < gomoku.Size; x++ {
			// 只考虑空点。
			if l.buildBoard().At(x, y) != "" {
				continue
			}
			switch l.Kind {
			case "win1":
				b := l.buildBoard()
				b.Apply(x, y, l.ToMove)
				if b.CheckWin(x, y) == l.ToMove {
					out = append(out, [2]int{x, y})
				}
			case "block1":
				// 执子方先落 c。
				b := l.buildBoard()
				b.Apply(x, y, l.ToMove)
				// 检查对手是否还存在任何立即取胜点 d。
				if !hasImmediateWin(b, opp) {
					out = append(out, [2]int{x, y})
				}
			}
		}
	}
	return out
}

// hasImmediateWin 判断 side 在当前局面下是否存在任意一个空点落子即可连五。
func hasImmediateWin(b *gomoku.Board, side gomoku.Color) bool {
	for y := 0; y < gomoku.Size; y++ {
		for x := 0; x < gomoku.Size; x++ {
			if b.At(x, y) != "" {
				continue
			}
			// 复制一份局面做试算，避免修改传入棋盘。
			trial := cloneWith(b, x, y, side)
			if trial.CheckWin(x, y) == side {
				return true
			}
		}
	}
	return false
}

// cloneWith 基于已有棋盘的落子内容重建一块棋盘，并在 (x,y) 处额外落一枚 side 子。
func cloneWith(b *gomoku.Board, x, y int, side gomoku.Color) *gomoku.Board {
	nb := gomoku.NewBoard()
	for yy := 0; yy < gomoku.Size; yy++ {
		for xx := 0; xx < gomoku.Size; xx++ {
			if c := b.At(xx, yy); c != "" {
				nb.Apply(xx, yy, c)
			}
		}
	}
	nb.Apply(x, y, side)
	return nb
}
