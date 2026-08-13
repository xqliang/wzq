package endgame

import "testing"

// 守卫测试：校验每个预置关卡的合法性与可解性。
func TestAllLevelsValid(t *testing.T) {
	for _, l := range Levels {
		// 1) 子数 6-12（用户要求残局更饱满）。
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
		// 3) 初始局面不得已有任意一方连五（残局应是未分胜负的中局）。
		b := l.buildBoard()
		for _, s := range l.Stones {
			if b.CheckWin(s.X, s.Y) != "" {
				t.Errorf("level %s 初始局面已存在五连（在 %d,%d）", l.ID, s.X, s.Y)
				break
			}
		}
		// 4) 可解：win1 至少 1 个正解；block1 恰好 1 个唯一挡点。
		ans := l.AcceptedAnswers()
		if len(ans) == 0 {
			t.Errorf("level %s (%s) 无解：AcceptedAnswers 为空", l.ID, l.Kind)
		}
		if l.Kind == "block1" && len(ans) != 1 {
			t.Errorf("level %s block1 期望唯一挡点，实际 %d 个: %v", l.ID, len(ans), ans)
		}
		t.Logf("level %s: %d 子, kind=%s, 正解=%v", l.ID, len(l.Stones), l.Kind, ans)
	}
}
