import { useEffect, useRef, useState } from 'react'
import { img } from '../lib/asset'
import { useNavigate, useLocation } from 'react-router-dom'
import { me, matchJoin, matchCancel } from '../net/rest'
import type { User } from '../net/rest'
import { rankLabel } from '../theme/ranks'
import { Avatar } from '../components/Avatar'
import { SettingsModal } from '../components/SettingsModal'

// 首页：LOGO + 资料/货币占位条 + 对战入口 + 运营入口（商店/签到/转盘占位）。
export function Home({ user }: { user: User }) {
  const nav = useNavigate()
  const loc = useLocation() as { state?: { autoMatch?: boolean } }
  const [u, setU] = useState<User>(user)
  // 随机匹配「匹配中」浮层：进入后轮询后端匹配池，配上对手再进对局。
  const [matching, setMatching] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const pollRef = useRef<number | undefined>(undefined)
  useEffect(() => {
    me().then(setU).catch(() => {})
  }, [])
  // 组件卸载时兜底清理轮询定时器。
  useEffect(() => () => window.clearTimeout(pollRef.current), [])

  // 开始随机匹配：进入浮层并轮询。waiting=false 拿到房间号即进入对局。
  const startMatch = () => {
    setMatching(true)
    const tick = () => {
      matchJoin()
        .then((r) => {
          if (!r.waiting && r.roomId) {
            window.clearTimeout(pollRef.current)
            setMatching(false)
            nav('/game', { state: { mode: 'pvp', roomId: r.roomId, matched: true } })
          } else {
            pollRef.current = window.setTimeout(tick, 1500) // 仍在等待，稍后再轮询
          }
        })
        .catch(() => {
          pollRef.current = window.setTimeout(tick, 2000) // 网络抖动：退避后重试
        })
    }
    tick()
  }
  // 取消匹配：停轮询、退出匹配池。
  const cancelMatch = () => {
    window.clearTimeout(pollRef.current)
    setMatching(false)
    matchCancel().catch(() => {})
  }

  // 从对局"再来一盘"(随机匹配)返回时携带 autoMatch，自动重新进入匹配。仅触发一次。
  useEffect(() => {
    if (loc.state?.autoMatch) startMatch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="home screen">
      <img src={img('logo_title')} alt="五子棋" className="home-logo" />
      <header className="profile">
        <Avatar src={img(`${u.avatar}`)} size={60} frame={u.equippedFrame || 'none'} />
        <div className="profile-meta">
          <div className="nick">{u.nickname}</div>
          <div className="rank-tag">{rankLabel(u.rankTier ?? 0)}</div>
        </div>
        <div className="currency">
          <span className="coin"><img src={img('icon_coin')} alt="金币" />{u.coins ?? 0}</span>
          <span className="scroll"><img src={img('icon_scroll')} alt="卷轴" />{u.scrolls ?? 0}</span>
        </div>
        <button className="settings-btn" onClick={() => setShowSettings(true)} aria-label="设置">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="#3a240f" aria-hidden="true">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.62-.94l-.36-2.54A.5.5 0 0 0 13.4 2h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L1.77 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.32.66.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.24.1.52.02.66-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
          </svg>
        </button>
      </header>
      <main className="entries">
        <button className="entry" onClick={() => nav('/ai')}>人机对战</button>
        <button className="entry primary" onClick={startMatch}>随机匹配</button>
        <button className="entry" onClick={() => nav('/room')}>好友对战</button>
        <button className="entry" onClick={() => nav('/endgame')}>残局闯关</button>
        <button className="entry" onClick={() => nav('/stats')}>我的战绩</button>
      </main>
      <nav className="ops-row">
        <button className="op-btn" onClick={() => nav('/shop')}>商店</button>
        <button className="op-btn" onClick={() => nav('/checkin')}>签到</button>
        <button className="op-btn" onClick={() => nav('/wheel')}>转盘</button>
      </nav>
      {matching && (
        <div className="matching-mask">
          <div className="matching-card">
            <div className="matching-spin" />
            <p className="matching-title">正在为你寻找对手…</p>
            <p className="matching-sub">同时在线的棋友将随机结对</p>
            <button className="op-btn" onClick={cancelMatch}>取消匹配</button>
          </div>
        </div>
      )}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
