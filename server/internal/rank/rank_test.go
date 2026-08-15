package rank

import "testing"

func TestLabel(t *testing.T) {
	cases := map[int]string{
		0: "业余1级", 8: "业余9级",
		9: "业余1段", 17: "业余9段",
		18: "大师",
		-5: "业余1级", // 越界夹底
		99: "大师",     // 越界夹顶
	}
	for tier, want := range cases {
		if got := Label(tier); got != want {
			t.Errorf("Label(%d)=%q want %q", tier, got, want)
		}
	}
}

func TestGroup(t *testing.T) {
	cases := map[int]string{0: "ji", 8: "ji", 9: "duan", 17: "duan", 18: "master"}
	for tier, want := range cases {
		if got := Group(tier); got != want {
			t.Errorf("Group(%d)=%q want %q", tier, got, want)
		}
	}
}

func TestThreshold(t *testing.T) {
	if Threshold(0) != 30 || Threshold(8) != 30 {
		t.Error("ji threshold want 30")
	}
	if Threshold(9) != 50 || Threshold(17) != 50 {
		t.Error("duan threshold want 50")
	}
	if Threshold(18) != 0 {
		t.Error("master threshold want 0 (capped)")
	}
}

func TestApplyWinBelowThreshold(t *testing.T) {
	tier, pts, up, down := Apply(0, 0, WinDelta)
	if tier != 0 || pts != 10 || up || down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 0/10/false/false", tier, pts, up, down)
	}
}

func TestApplyWinPromotesExactly(t *testing.T) {
	// 业余1级 20 分 + 10 = 30 = 阈值 -> 升到业余2级，余 0。
	tier, pts, up, down := Apply(0, 20, WinDelta)
	if tier != 1 || pts != 0 || !up || down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 1/0/true/false", tier, pts, up, down)
	}
}

func TestApplyWinCarriesAcrossMultipleTiers(t *testing.T) {
	// 大增量应连续升阶并带入余量：0 分 +70 -> 阈值30 两次 (=60)，余 10 落在业余3级。
	tier, pts, up, down := Apply(0, 0, 70)
	if tier != 2 || pts != 10 || !up || down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 2/10/true/false", tier, pts, up, down)
	}
}

func TestApplyLossNoDemoteWhenPositive(t *testing.T) {
	tier, pts, up, down := Apply(1, 10, LossDelta)
	if tier != 1 || pts != 0 || up || down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 1/0/false/false", tier, pts, up, down)
	}
}

func TestApplyLossDemotesBorrowingThreshold(t *testing.T) {
	// 业余2级 0 分 -10 -> 跌破 0，降到业余1级，借业余1级阈值 30 补回 -> 20。
	tier, pts, up, down := Apply(1, 0, LossDelta)
	if tier != 0 || pts != 20 || up || !down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 0/20/false/true", tier, pts, up, down)
	}
}

func TestApplyFloorAtBottom(t *testing.T) {
	// 业余1级 0 分再负：封底 0 分，不降阶。
	tier, pts, up, down := Apply(0, 0, LossDelta)
	if tier != 0 || pts != 0 || up || down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 0/0/false/false", tier, pts, up, down)
	}
}

func TestApplyJiToDuanBoundary(t *testing.T) {
	// 业余9级(8) 20 分 +10 = 30 -> 升到业余1段(9)。
	tier, pts, up, down := Apply(8, 20, WinDelta)
	if tier != 9 || pts != 0 || !up || down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 9/0/true/false", tier, pts, up, down)
	}
	if Group(tier) != "duan" {
		t.Fatalf("group after promote = %s want duan", Group(tier))
	}
}

func TestApplyDuanToJiDemotion(t *testing.T) {
	// 业余1段(9) 0 分 -10 -> 降到业余9级(8)，借 ji 阈值 30 -> 20。
	tier, pts, up, down := Apply(9, 0, LossDelta)
	if tier != 8 || pts != 20 || up || !down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 8/20/false/true", tier, pts, up, down)
	}
}

func TestApplyMasterCap(t *testing.T) {
	// 大师封顶：不再升阶，分数夹到上限 50。
	tier, pts, up, down := Apply(masterTier, 45, WinDelta)
	if tier != masterTier || pts != 50 || up || down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 18/50/false/false", tier, pts, up, down)
	}
}

func TestApplyMasterDemotion(t *testing.T) {
	// 大师 0 分负 -> 跌回业余9段(17)，借 duan 阈值 50 -> 40。
	tier, pts, up, down := Apply(masterTier, 0, LossDelta)
	if tier != 17 || pts != 40 || up || !down {
		t.Fatalf("got tier=%d pts=%d up=%v down=%v want 17/40/false/true", tier, pts, up, down)
	}
}
