package endgame

// 关卡生成器（仅在 GEN=1 时运行，正常测试套件会 Skip，不拖慢 CI）。
// 思路：模拟若干拟真短对局（从天元开局、只在已有棋子周围落子、以简单连线势
// 启发式为主偏好），在每次白方落子后（即轮到黑方）用解算器判断黑方是否存在
// 2..5 步必胜（连续冲四 VCF）。命中且局面自然（8..22 子、无既成五连）则记录，
// 去重后按必胜步数升序打印为可直接粘贴的 Level 字面量。
//
// 运行： GEN=1 go test ./internal/endgame -run TestGenerateLevels -v

import (
	"fmt"
	"math/rand"
	"os"
	"sort"
	"strings"
	"testing"

	"github.com/wzq/gomoku/internal/gomoku"
)

// hasAnyFive 判断盘面上是否任意一方已经连五。
func hasAnyFive(g *grid) bool {
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			c := g[y][x]
			if c != "" && winAt(g, x, y, c) {
				return true
			}
		}
	}
	return false
}

// linePotential 评估在 (x,y) 落 c 子的进攻势：按 4 个方向的连子长度与开放端加权。
// 双活（两端皆空）权重更高，单活次之，两端皆堵则该方向无价值。
func linePotential(g *grid, x, y int, c gomoku.Color) int {
	total := 0
	for _, d := range solveDirs {
		cnt := 1
		open := 0
		for _, s := range [2]int{1, -1} {
			nx, ny := x+d[0]*s, y+d[1]*s
			for inBounds(nx, ny) && g[ny][nx] == c {
				cnt++
				nx += d[0] * s
				ny += d[1] * s
			}
			if inBounds(nx, ny) && g[ny][nx] == "" {
				open++
			}
		}
		w := cnt * cnt
		switch open {
		case 2:
			w *= 3
		case 1:
			// 保持基础权重
		default:
			w = 0
		}
		total += w
	}
	return total
}

// neighborEmpties 返回所有「距已有棋子 1 格内」的空点（保证棋形聚拢）。
func neighborEmpties(g *grid) [][2]int {
	seen := map[[2]int]bool{}
	var out [][2]int
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			if g[y][x] == "" {
				continue
			}
			for dy := -1; dy <= 1; dy++ {
				for dx := -1; dx <= 1; dx++ {
					nx, ny := x+dx, y+dy
					if !inBounds(nx, ny) || g[ny][nx] != "" {
						continue
					}
					k := [2]int{nx, ny}
					if !seen[k] {
						seen[k] = true
						out = append(out, k)
					}
				}
			}
		}
	}
	return out
}

// chooseMove 为 color 选择一手：70% 概率取「己方进攻势 + 0.8×封堵对手势」最大者，
// 否则在邻域空点中随机，模拟拟真但不完美的对局。
func chooseMove(g *grid, color gomoku.Color, rng *rand.Rand) [2]int {
	cands := neighborEmpties(g)
	if len(cands) == 0 {
		return [2]int{-1, -1}
	}
	if rng.Float64() < 0.30 {
		return cands[rng.Intn(len(cands))]
	}
	opp := other(color)
	best := cands[0]
	bestScore := -1
	for _, c := range cands {
		off := linePotential(g, c[0], c[1], color)
		def := linePotential(g, c[0], c[1], opp)
		score := off*10 + def*8
		if score > bestScore {
			bestScore = score
			best = c
		}
	}
	return best
}

// canon 生成局面的规范化去重键（按 y,x,color 排序）。
func canon(ss []Stone) string {
	cp := append([]Stone(nil), ss...)
	sort.Slice(cp, func(i, j int) bool {
		if cp[i].Y != cp[j].Y {
			return cp[i].Y < cp[j].Y
		}
		if cp[i].X != cp[j].X {
			return cp[i].X < cp[j].X
		}
		return cp[i].Color < cp[j].Color
	})
	var b strings.Builder
	for _, s := range cp {
		fmt.Fprintf(&b, "%d,%d,%s;", s.X, s.Y, s.Color)
	}
	return b.String()
}

type genCand struct {
	stones []Stone
	depth  int
}

func TestGenerateLevels(t *testing.T) {
	if os.Getenv("GEN") == "" {
		t.Skip("set GEN=1 to run the level generator")
	}
	need := map[int]int{2: 9, 3: 9, 4: 6, 5: 6, 6: 4, 7: 3}
	got := map[int]int{}
	found := map[string]genCand{}
	enough := func() bool {
		for d, n := range need {
			if got[d] < n {
				return false
			}
		}
		return true
	}

	const maxSeeds = 80000
	for seed := int64(1); seed <= maxSeeds && !enough(); seed++ {
		rng := rand.New(rand.NewSource(seed))
		var g grid
		g[7][7] = gomoku.Black
		stones := []Stone{{7, 7, gomoku.Black}}
		color := gomoku.White // 天元黑子后轮到白方
		for ply := 0; ply < 34; ply++ {
			mv := chooseMove(&g, color, rng)
			if mv[0] < 0 {
				break
			}
			g[mv[1]][mv[0]] = color
			stones = append(stones, Stone{mv[0], mv[1], color})
			if hasAnyFive(&g) {
				break // 出现五连，本局结束
			}
			// 每次白方落子后，轮到黑方：检查黑方是否 2..maxMateSteps 步必胜。
			if color == gomoku.White && len(stones) >= 8 && len(stones) <= 24 {
				d := minMateDepth(&g, gomoku.Black, maxMateSteps)
				if d >= 2 && d <= maxMateSteps {
					key := canon(stones)
					if _, ok := found[key]; !ok {
						found[key] = genCand{append([]Stone(nil), stones...), d}
						got[d]++
					}
				}
			}
			color = other(color)
		}
	}

	// 收集并按 depth 升序、子数升序排序。
	cands := make([]genCand, 0, len(found))
	for _, c := range found {
		cands = append(cands, c)
	}
	sort.Slice(cands, func(i, j int) bool {
		if cands[i].depth != cands[j].depth {
			return cands[i].depth < cands[j].depth
		}
		return len(cands[i].stones) < len(cands[j].stones)
	})

	nameByDepth := map[int]string{2: "活三杀", 3: "四三杀", 4: "连环杀", 5: "胜势残局", 6: "步步紧逼", 7: "绝处逢生"}
	t.Logf("generated: d2=%d d3=%d d4=%d d5=%d (total %d)", got[2], got[3], got[4], got[5], len(cands))

	idx := 0
	for _, c := range cands {
		idx++
		id := fmt.Sprintf("%d-%d", c.depth-1, idx)
		var b strings.Builder
		fmt.Fprintf(&b, "\n{\n\tID: %q, Chapter: %d, Name: %q, Difficulty: %d, ToMove: gomoku.Black,\n\tStones: []Stone{\n",
			id, c.depth-1, nameByDepth[c.depth], c.depth)
		// 分黑白两行，便于阅读。
		writeRow := func(col gomoku.Color, label string) {
			b.WriteString("\t\t")
			for _, s := range c.stones {
				if s.Color == col {
					fmt.Fprintf(&b, "{%d, %d, gomoku.%s}, ", s.X, s.Y, label)
				}
			}
			b.WriteString("\n")
		}
		writeRow(gomoku.Black, "Black")
		writeRow(gomoku.White, "White")
		b.WriteString("\t},\n},")
		t.Logf("depth=%d stones=%d%s", c.depth, len(c.stones), b.String())
	}
}
