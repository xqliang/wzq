// 段位阶梯「展示用镜像」：与后端 internal/rank 的阶名保持一致（阶段 B 落地权威计算）。
// 索引 0..8 业余1级..业余9级；9..17 业余1段..业余9段；18 大师。共 19 阶。
export const RANK_COUNT = 19

// 夹紧到合法索引，避免越界。
function clampTier(tier: number): number {
  if (tier < 0) return 0
  if (tier > RANK_COUNT - 1) return RANK_COUNT - 1
  return Math.floor(tier)
}

// 段位中文名。
export function rankLabel(tier: number): string {
  const t = clampTier(tier)
  if (t === 18) return '大师'
  if (t < 9) return `业余${t + 1}级`
  return `业余${t - 9 + 1}段`
}

// 段位分档（选奖章素材用）：ji=业余级，duan=业余段，master=大师。
export function rankGroup(tier: number): 'ji' | 'duan' | 'master' {
  const t = clampTier(tier)
  if (t === 18) return 'master'
  return t < 9 ? 'ji' : 'duan'
}

// 升阶所需阶内积分阈值（镜像后端 rank.Threshold）：业余级 30、业余段 50；
// 大师封顶，用 50 作为进度条满格展示上限。
export function rankThreshold(tier: number): number {
  const t = clampTier(tier)
  if (t === 18) return 50
  return t < 9 ? 30 : 50
}
