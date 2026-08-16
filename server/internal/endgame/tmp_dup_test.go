package endgame

import (
	"fmt"
	"testing"
)

// 列出所有按提示线分组的关卡，找出解法重复的 ID（保留每组第一个）。
func TestListDupLines(t *testing.T) {
	groups := map[string][]string{}
	for i := range Levels {
		l := &Levels[i]
		key := fmt.Sprint(l.HintLine())
		groups[key] = append(groups[key], l.ID)
	}
	for key, ids := range groups {
		if len(ids) > 1 {
			t.Logf("重复线 %s => %v", key, ids)
		}
	}
}
