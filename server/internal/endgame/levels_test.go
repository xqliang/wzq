package endgame

import "testing"

// 守卫测试：校验每个预置关卡的合法性与可解性（真正意义的多步必胜残局）。
func TestAllLevelsValid(t *testing.T) {
	for _, l := range Levels {
		// 1) 子数 8-24（真实中局残局，允许较多聚拢棋子）。
		if len(l.Stones) < 8 || len(l.Stones) > 24 {
			t.Errorf("level %s 子数 %d 不在 8-24 范围", l.ID, len(l.Stones))
		}
		// 2) 无重复坐标。
		seen := map[[2]int]bool{}
		for _, s := range l.Stones {
			k := [2]int{s.X, s.Y}
			if seen[k] {
				t.Errorf("level %s 坐标重复 %v", l.ID, k)
			}
			seen[k] = true
		}
		// 3) 初始局面不得已有任意一方连五。
		g := gridFromStones(l.Stones)
		for _, s := range l.Stones {
			if winAt(&g, s.X, s.Y, s.Color) {
				t.Errorf("level %s 初始已存在五连（%d,%d）", l.ID, s.X, s.Y)
				break
			}
		}
		// 4) 存在 2..maxMateSteps 步必胜（多步残局，须≥2 步），且有可接受首着。
		steps := l.MinSteps()
		ans := l.AcceptedAnswers()
		if steps < 2 || steps > maxMateSteps {
			t.Errorf("level %s 无 2-%d 步必胜（MinSteps=%d）", l.ID, maxMateSteps, steps)
		}
		if len(ans) == 0 {
			t.Errorf("level %s 无可接受首着", l.ID)
		}
		// 5) Difficulty 应与必胜步数一致（生成器约定）。
		if l.Difficulty != steps {
			t.Errorf("level %s Difficulty=%d 与必胜步数 %d 不一致", l.ID, l.Difficulty, steps)
		}
		t.Logf("level %s: %d 子, 必胜步数=%d, 首着=%v", l.ID, len(l.Stones), steps, ans)
	}
}

// 校验每关的可接受首着确实导向必胜：落下该首着并让防守方堵在其某个取胜点后，
// 攻击方仍存在必胜（forcedWin 为真），确保答案不是「假杀」。
func TestAcceptedFirstMovesKeepForcedWin(t *testing.T) {
	for _, l := range Levels {
		ans := l.AcceptedAnswers()
		if len(ans) == 0 {
			t.Errorf("level %s 无可接受首着", l.ID)
			continue
		}
		g := gridFromStones(l.Stones)
		// 若首步即可成五（不该发生，因 MinSteps>=2），跳过深度校验。
		if len(immediateWins(&g, l.ToMove)) > 0 {
			t.Errorf("level %s 首步即可连五，不应作为多步残局", l.ID)
			continue
		}
		for _, mv := range ans {
			gg := gridFromStones(l.Stones)
			gg[mv[1]][mv[0]] = l.ToMove
			threats := immediateWins(&gg, l.ToMove)
			if len(threats) == 0 {
				t.Errorf("level %s 首着 %v 未形成冲四威胁", l.ID, mv)
				continue
			}
			// 防守方堵住任一取胜点后，攻击方仍应必胜（剩余步数 = maxMateSteps-1，
			// 覆盖所有可接受首着在解算上限内的必胜，而不只最小步解）。
			def := other(l.ToMove)
			t0 := threats[0]
			gg[t0[1]][t0[0]] = def
			if !forcedWin(&gg, l.ToMove, maxMateSteps-1) {
				t.Errorf("level %s 首着 %v 堵 %v 后攻击方失去必胜", l.ID, mv, t0)
			}
		}
	}
}
