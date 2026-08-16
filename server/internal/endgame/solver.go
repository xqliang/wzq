// solver.go：残局解算器。用「连续冲四(VCF)」思想判定执子方能否在 k 步内必胜，
// 并给出可达成必胜的首着集合。落子面用轻量 grid 值类型，便于试算/回退。
package endgame

import "github.com/wzq/gomoku/internal/gomoku"

const size = gomoku.Size

// maxMateSteps 是残局解算支持的最大必胜步数（VCF 连续冲四），
// 决定 MinSteps/AcceptedAnswers/HintLine 的搜索上限。
const maxMateSteps = 6

type grid [size][size]gomoku.Color

func inBounds(x, y int) bool { return x >= 0 && y >= 0 && x < size && y < size }

func gridFromStones(ss []Stone) grid {
	var g grid
	for _, s := range ss {
		if inBounds(s.X, s.Y) {
			g[s.Y][s.X] = s.Color
		}
	}
	return g
}

var solveDirs = [4][2]int{{1, 0}, {0, 1}, {1, 1}, {1, -1}}

// winAt 判断 (x,y) 处的 c 子是否形成五连。
func winAt(g *grid, x, y int, c gomoku.Color) bool {
	for _, d := range solveDirs {
		cnt := 1
		for _, s := range [2]int{1, -1} {
			nx, ny := x+d[0]*s, y+d[1]*s
			for inBounds(nx, ny) && g[ny][nx] == c {
				cnt++
				nx += d[0] * s
				ny += d[1] * s
			}
		}
		if cnt >= 5 {
			return true
		}
	}
	return false
}

// immediateWins 返回 c 的所有「立即取胜点」（空点落子即成五）。
func immediateWins(g *grid, c gomoku.Color) [][2]int {
	var out [][2]int
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if g[y][x] != "" {
				continue
			}
			g[y][x] = c
			if winAt(g, x, y, c) {
				out = append(out, [2]int{x, y})
			}
			g[y][x] = ""
		}
	}
	return out
}

// hasImmediateWinSolve 判断 c 是否存在任意立即取胜点。
func hasImmediateWinSolve(g *grid, c gomoku.Color) bool {
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if g[y][x] != "" {
				continue
			}
			g[y][x] = c
			w := winAt(g, x, y, c)
			g[y][x] = ""
			if w {
				return true
			}
		}
	}
	return false
}

// nearStone 限定只在已有棋子附近 2 格内搜索，收敛分支。
func nearStone(g *grid, x, y int) bool {
	for dy := -2; dy <= 2; dy++ {
		for dx := -2; dx <= 2; dx++ {
			nx, ny := x+dx, y+dy
			if inBounds(nx, ny) && g[ny][nx] != "" {
				return true
			}
		}
	}
	return false
}

// forcedWin 判断 attacker（先手）能否在 depth 步（自己的落子数，第 depth 手落下即成五）内，
// 通过连续冲四逼死对手。对手被动应招：面对冲四只能堵在取胜点；堵不完（双威胁）则告负。
func forcedWin(g *grid, attacker gomoku.Color, depth int) bool {
	if depth < 1 {
		return false
	}
	if hasImmediateWinSolve(g, attacker) {
		return true // 一手成五
	}
	if depth < 2 {
		return false // 无立即取胜且无后续步数
	}
	defender := other(attacker)
	defenderThreatened := hasImmediateWinSolve(g, defender)
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if g[y][x] != "" || !nearStone(g, x, y) {
				continue
			}
			g[y][x] = attacker
			threats := immediateWins(g, attacker)
			if len(threats) == 0 {
				g[y][x] = "" // 非冲四，跳过（VCF）
				continue
			}
			// 本着必须不给对手留立即取胜点（若对手本有威胁，须一并消解）。
			if defenderThreatened && hasImmediateWinSolve(g, defender) {
				g[y][x] = ""
				continue
			}
			// 对手只能堵在某个取胜点上（否则我方立即成五）。要求无论堵哪个点我方都仍必胜。
			allWin := true
			for _, t := range threats {
				g[t[1]][t[0]] = defender
				ok := forcedWin(g, attacker, depth-1)
				g[t[1]][t[0]] = ""
				if !ok {
					allWin = false
					break
				}
			}
			g[y][x] = ""
			if allWin {
				return true
			}
		}
	}
	return false
}

// solveFirstMoves 返回所有「能在 maxDepth 步内导向必胜」的首着。
func solveFirstMoves(g *grid, attacker gomoku.Color, maxDepth int) [][2]int {
	if imm := immediateWins(g, attacker); len(imm) > 0 {
		return imm // 一步取胜
	}
	if maxDepth < 2 {
		return nil
	}
	defender := other(attacker)
	defenderThreatened := hasImmediateWinSolve(g, defender)
	var res [][2]int
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if g[y][x] != "" || !nearStone(g, x, y) {
				continue
			}
			g[y][x] = attacker
			threats := immediateWins(g, attacker)
			ok := len(threats) > 0
			if ok && defenderThreatened && hasImmediateWinSolve(g, defender) {
				ok = false
			}
			if ok {
				for _, t := range threats {
					g[t[1]][t[0]] = defender
					win := forcedWin(g, attacker, maxDepth-1)
					g[t[1]][t[0]] = ""
					if !win {
						ok = false
						break
					}
				}
			}
			g[y][x] = ""
			if ok {
				res = append(res, [2]int{x, y})
			}
		}
	}
	return res
}

// minMateDepth 返回执子方在 cap 步内的最小必胜步数；无解返回 0。
func minMateDepth(g *grid, attacker gomoku.Color, cap int) int {
	for k := 1; k <= cap; k++ {
		if forcedWin(g, attacker, k) {
			return k
		}
	}
	return 0
}
