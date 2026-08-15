// 段位进阶界面：旧段位 -> 新段位 + 奖章 + 金币，点任意处继续。
// group 决定奖章素材（ji/duan/master）。
import { Banner } from './Banner'
import { img } from '../lib/asset'
import type { rankGroup as RankGroupFn } from '../theme/ranks'

type Group = ReturnType<typeof RankGroupFn>

export function RankUpOverlay({
  fromLabel,
  toLabel,
  group,
  coins,
  onContinue,
}: {
  fromLabel: string
  toLabel: string
  group: Group
  coins: number
  onContinue: () => void
}) {
  return (
    <div className="rankup-overlay" onClick={onContinue}>
      <Banner text="段位进阶" tone="gold" />
      <div className="rankup-transit">
        <span className="rankup-from">{fromLabel}</span>
        <span className="rankup-arrow">➜</span>
        <span className="rankup-to">{toLabel}</span>
      </div>
      <img className="rankup-medal" src={img(`medal_${group}`)} alt="" />
      <div className="reward-row">
        <img src={img('icon_coin')} alt="金币" />
        <span>+{coins}</span>
      </div>
      <div className="rankup-hint">点击任意位置继续</div>
    </div>
  )
}
