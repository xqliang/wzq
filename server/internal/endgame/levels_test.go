package endgame

import "testing"

// 保证每个预置关卡都可解：win1 至少 1 个可接受落子；block1 恰好按“唯一挡点”设计。
func TestAllLevelsSolvable(t *testing.T) {
	for _, l := range Levels {
		ans := l.AcceptedAnswers()
		if len(ans) == 0 {
			t.Fatalf("level %s (%s) 无解：AcceptedAnswers 为空", l.ID, l.Kind)
		}
		if l.Kind == "block1" && len(ans) != 1 {
			t.Fatalf("level %s block1 期望唯一挡点，实际 %d 个: %v", l.ID, len(ans), ans)
		}
	}
}
