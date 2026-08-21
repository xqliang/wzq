// 对局顶部对阵条：左右玩家（头像/昵称/段位/执子色），中间罗盘倒计时，▶ 指向当前手。
// 真人模式下点头像可弹出表情/快捷语面板；收到表情时在对应玩家头像下飘字。
import { Avatar } from './Avatar'
import { img } from '../lib/asset'
import { CompassTimer } from './CompassTimer'
import type { CountdownLevel } from '../lib/countdown'

export interface PlayerInfo {
  uid?: number // 玩家 id（用于判断收到的表情归属哪一侧；人机对手可为空）
  nickname: string
  avatar: string // 图片文件名（不含扩展）
  rankLabel: string
  color: 'black' | 'white'
  frame?: string // 头像框皮肤 id（缺省无框）
}

export function PlayerBar({
  me,
  opp,
  turn,
  timer,
  myUid,
  emote,
  onMeAvatarClick,
}: {
  me: PlayerInfo
  opp: PlayerInfo
  turn: 'black' | 'white'
  timer: { remain: number; progress: number; level: CountdownLevel } | null
  myUid?: number
  emote?: { uid: number; text: string } | null
  onMeAvatarClick?: () => void
}) {
  // 判断一条表情是否归属「我」这一侧（me 侧 uid===myUid）。
  const emoteOnMe = !!emote && myUid != null && emote.uid === myUid
  const emoteOnOpp = !!emote && !emoteOnMe
  return (
    <div className="player-bar">
      <PlayerSide p={me} active={turn === me.color} side="left" emote={emoteOnMe ? emote?.text : undefined} onAvatarClick={onMeAvatarClick} />
      <div className="player-bar-center">
        {turn === me.color ? <span className="turn-arrow">◀</span> : <span className="turn-arrow">▶</span>}
        {timer ? <CompassTimer {...timer} /> : <div className="compass-idle" />}
      </div>
      <PlayerSide p={opp} active={turn === opp.color} side="right" emote={emoteOnOpp ? emote?.text : undefined} />
    </div>
  )
}

function PlayerSide({
  p,
  active,
  side,
  emote,
  onAvatarClick,
}: {
  p: PlayerInfo
  active: boolean
  side: 'left' | 'right'
  emote?: string
  onAvatarClick?: () => void
}) {
  const clickable = !!onAvatarClick
  return (
    <div className={`player-side ${side} ${active ? 'active' : ''}`}>
      <div className="player-avatar-wrap">
        {/* 表情气泡：绝对定位于头像上方，带小尾巴指向头像；按左右侧分别向内对齐，避免溢出屏幕。 */}
        {emote && <span className={`emote-bubble emote-${side}`}>{emote}</span>}
        <div
          className={`player-avatar${clickable ? ' clickable' : ''}`}
          onClick={clickable ? onAvatarClick : undefined}
          role={clickable ? 'button' : undefined}
          aria-label={clickable ? '发送表情' : undefined}
        >
          <Avatar src={img(`${p.avatar}`)} size={36} frame={p.frame} />
        </div>
      </div>
      <div className="player-meta">
        <div className="player-nick">{p.nickname}</div>
        <div className="player-rank">{p.rankLabel}</div>
      </div>
      <span className={`stone-chip ${p.color}`} />
    </div>
  )
}
