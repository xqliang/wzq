package endgame

import "testing"

// 守卫测试：校验每个预置关卡的合法性与可解性（真正意义的必胜残局）。
func TestAllLevelsValid(t *testing.T) {
	for _, l := range Levels {
		// 1) 子数 6-12。
		if len(l.Stones) < 6 || len(l.Stones) > 12 {
			t.Errorf("level %s 子数 %d 不在 6-12 范围", l.ID, len(l.Stones))
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
		// 4) 存在 1-5 步必胜，且有可接受首着。
		steps := l.MinSteps()
		ans := l.AcceptedAnswers()
		if steps < 1 || steps > 5 {
			t.Errorf("level %s 无 1-5 步必胜（MinSteps=%d）", l.ID, steps)
		}
		if len(ans) == 0 {
			t.Errorf("level %s 无可接受首着", l.ID)
		}
		t.Logf("level %s: %d 子, 必胜步数=%d, 首着=%v", l.ID, len(l.Stones), steps, ans)
	}
}
