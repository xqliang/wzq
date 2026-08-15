// 对局顶部对阵条：左右玩家（头像/昵称/段位/执子色），中间罗盘倒计时，▶ 指向当前手。
import { Avatar } from './Avatar'
import { CompassTimer } from './CompassTimer'
import type { CountdownLevel } from '../lib/countdown'

export interface PlayerInfo {
  nickname: string
  avatar: string // 图片文件名（不含扩展）
  rankLabel: string
  color: 'black' | 'white'
}

export function PlayerBar({
  me,
  opp,
  turn,
  timer,
}: {
  me: PlayerInfo
  opp: PlayerInfo
  turn: 'black' | 'white'
  timer: { remain: number; progress: number; level: CountdownLevel } | null
}) {
  return (
    <div className="player-bar">
      <PlayerSide p={me} active={turn === me.color} side="left" />
      <div className="player-bar-center">
        {turn === me.color ? <span className="turn-arrow">◀</span> : <span className="turn-arrow">▶</span>}
        {timer ? <CompassTimer {...timer} /> : <div className="compass-idle" />}
      </div>
      <PlayerSide p={opp} active={turn === opp.color} side="right" />
    </div>
  )
}

function PlayerSide({ p, active, side }: { p: PlayerInfo; active: boolean; side: 'left' | 'right' }) {
  return (
    <div className={`player-side ${side} ${active ? 'active' : ''}`}>
      <Avatar src={`/assets/img/${p.avatar}.png`} size={36} />
      <div className="player-meta">
        <div className="player-nick">{p.nickname}</div>
        <div className="player-rank">{p.rankLabel}</div>
      </div>
      <span className={`stone-chip ${p.color}`} />
    </div>
  )
}
