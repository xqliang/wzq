// 对局结算覆盖层。win=true 胜利版（段位VS/进度/金币/双倍），false 失败版。
// 阶段 A：段位进度、金币均为占位数据（props 传入），双倍/分享点击占位。
import { Banner } from './Banner'
import { img } from '../lib/asset'
import { Avatar } from './Avatar'

export interface ResultPlayer {
  nickname: string
  avatar: string
  rankLabel: string
  points: number
  threshold: number
  delta: number // +10 / -10
  frame?: string // 头像框皮肤 id
}

export function ResultOverlay({
  win,
  me,
  opp,
  coins,
  onRematch,
  onHome,
  onShare,
  onDouble,
  doubled = false,
  adPlaying = false,
}: {
  win: boolean
  me: ResultPlayer
  opp: ResultPlayer
  coins: number
  onRematch: () => void
  onHome: () => void
  onShare: () => void
  onDouble: () => void
  doubled?: boolean
  adPlaying?: boolean
}) {
  return (
    <div className="result-overlay">
      <div className="result-top">
        <button className="round-btn" onClick={onHome} aria-label="回首页">🏠</button>
        <button className="round-btn" onClick={onShare} aria-label="分享">🔗</button>
      </div>
      <Banner text={win ? '胜利' : '失败'} tone={win ? 'gold' : 'silver'} />
      {win && (
        <>
          <div className="result-vs">
            <ResultSide p={me} />
            <span className="vs-mark">VS</span>
            <ResultSide p={opp} />
          </div>
          <div className="reward-row">
            <img src={img('icon_coin')} alt="金币" />
            <span>+{coins}</span>
          </div>
          <button className="ad-double" onClick={onDouble} disabled={doubled || adPlaying}>
            {doubled ? '已翻倍领取' : adPlaying ? '广告播放中…' : '看广告双倍领取'}
          </button>
        </>
      )}
      <button className="rematch" onClick={onRematch}>再来一盘</button>
    </div>
  )
}

function ResultSide({ p }: { p: ResultPlayer }) {
  const pct = Math.max(0, Math.min(100, (p.points / p.threshold) * 100))
  return (
    <div className="result-side">
      <Avatar src={img(`${p.avatar}`)} size={64} frame={p.frame} />
      <div className="result-rank">{p.rankLabel}</div>
      <div className="result-nick">{p.nickname}</div>
      <div className="rank-bar">
        <div className="rank-bar-fill" style={{ width: `${pct}%` }} />
        <span className="rank-bar-text">{p.points}/{p.threshold}</span>
      </div>
      <div className={p.delta >= 0 ? 'delta up' : 'delta down'}>
        {p.delta >= 0 ? `↑+${p.delta}` : `↓${p.delta}`}
      </div>
    </div>
  )
}
