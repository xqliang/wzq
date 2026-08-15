// Package rank 是段位阶梯的**权威计算**（前端 web/src/theme/ranks.ts 为展示镜像）。
//
// 阶梯共 19 阶（索引 0..18）：
//   0..8   业余1级..业余9级   （组 ji，升段阈值 30 分）
//   9..17  业余1段..业余9段   （组 duan，升段阈值 50 分）
//   18     大师               （组 master，封顶，无更高阶）
//
// 计分：胜 +10 分、负 -10 分（见 WinDelta/LossDelta）。分数累积到当前阶阈值即升一阶
// （多余分数带入下一阶）；分数跌破 0 则降一阶（借下一阶的阈值补回）。业余1级为地板
// （0 分封底不再降），大师为天花板（不再升）。
package rank

import "strconv"

// 阶梯规模与分组边界。
const (
	Count      = 19 // 总阶数
	jiTiers    = 9  // 业余「级」的阶数（索引 0..8）
	duanTiers  = 9  // 业余「段」的阶数（索引 9..17）
	masterTier = 18 // 大师（封顶）索引

	WinDelta  = 10  // 胜一局加分
	LossDelta = -10 // 负一局扣分

	jiThreshold   = 30 // 业余级升阶阈值
	duanThreshold = 50 // 业余段升阶阈值
)

// clamp 将 tier 夹到 [0, Count-1]。
func clamp(tier int) int {
	if tier < 0 {
		return 0
	}
	if tier > Count-1 {
		return Count - 1
	}
	return tier
}

// Group 返回该阶所属分组：ji=业余级，duan=业余段，master=大师（选奖章素材用）。
func Group(tier int) string {
	t := clamp(tier)
	if t == masterTier {
		return "master"
	}
	if t < jiTiers {
		return "ji"
	}
	return "duan"
}

// Label 返回段位中文名，与前端镜像（web/src/theme/ranks.ts）保持逐字一致。
func Label(tier int) string {
	t := clamp(tier)
	if t == masterTier {
		return "大师"
	}
	if t < jiTiers {
		return "业余" + strconv.Itoa(t+1) + "级"
	}
	return "业余" + strconv.Itoa(t-jiTiers+1) + "段"
}

// Threshold 返回**从该阶晋级到下一阶**所需的分数上限。
// 大师封顶：返回 0，调用方据此判定不再晋级。
func Threshold(tier int) int {
	t := clamp(tier)
	if t == masterTier {
		return 0
	}
	if t < jiTiers {
		return jiThreshold
	}
	return duanThreshold
}

// Apply 依据胜负增量结算段位：
//
//	tier,points   当前阶与当前阶内积分
//	delta         本局增量（WinDelta / LossDelta）
//
// 返回结算后的阶与阶内积分，以及是否发生升阶/降阶（供前端触发晋级动画）。
// 规则：升阶带入多余分；降阶借下一阶阈值补回；业余1级 0 分封底；大师封顶。
func Apply(tier, points, delta int) (newTier, newPoints int, promoted, demoted bool) {
	tier = clamp(tier)
	points += delta

	// 升阶：分数达到当前阶阈值则进阶，余量带入；大师封顶停止。
	for tier < masterTier {
		th := Threshold(tier)
		if points < th {
			break
		}
		points -= th
		tier++
		promoted = true
	}
	// 大师封顶：分数不再无限膨胀，夹到大师阈值上限（用业余段阈值作为满格展示上限）。
	if tier == masterTier && points > duanThreshold {
		points = duanThreshold
	}

	// 降阶：分数跌破 0 则退阶，借退入阶的阈值补回；业余1级 0 分封底。
	for points < 0 {
		if tier == 0 {
			points = 0
			break
		}
		tier--
		points += Threshold(tier)
		demoted = true
	}
	return tier, points, promoted, demoted
}
