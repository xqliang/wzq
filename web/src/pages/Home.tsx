import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { me, matchJoin, matchCancel } from '../net/rest'
import type { User } from '../net/rest'
import { rankLabel } from '../theme/ranks'
import { Avatar } from '../components/Avatar'

// 首页：LOGO + 资料/货币占位条 + 对战入口 + 运营入口（商店/签到/转盘占位）。
export function Home({ user }: { user: User }) {
  const nav = useNavigate()
  const [u, setU] = useState<User>(user)
  // 随机匹配「匹配中」浮层：进入后轮询后端匹配池，配上对手再进对局。
  const [matching, setMatching] = useState(false)
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
            nav('/game', { state: { mode: 'pvp', roomId: r.roomId } })
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

  return (
    <div className="home screen">
      <img src="/assets/img/logo_title.png" alt="五子棋" className="home-logo" />
      <header className="profile">
        <Avatar src={`/assets/img/${u.avatar}.png`} size={60} />
        <div>
          <div className="nick">{u.nickname}</div>
          <div className="rank-tag">{rankLabel(u.rankTier ?? 0)}</div>
        </div>
        <div className="currency">
          <span className="coin"><img src="/assets/img/icon_coin.png" alt="金币" />{u.coins ?? 0}</span>
          <span className="scroll"><img src="/assets/img/icon_scroll.png" alt="卷轴" />{u.scrolls ?? 0}</span>
        </div>
        <button className="settings-btn" onClick={() => nav('/settings')}>⚙️</button>
      </header>
      <main className="entries">
        <button className="entry" onClick={() => nav('/ai')}>人机对战</button>
        <button className="entry primary" onClick={startMatch}>随机匹配</button>
        <button className="entry" onClick={() => nav('/room')}>好友对战</button>
        <button className="entry" onClick={() => nav('/endgame')}>残局闯关</button>
        <button className="entry" onClick={() => nav('/stats')}>我的战绩</button>
      </main>
      <nav className="ops-row">
        <button className="op-btn" onClick={() => alert('商店（阶段C）')}>商店</button>
        <button className="op-btn" onClick={() => alert('每日签到（阶段D）')}>签到</button>
        <button className="op-btn" onClick={() => alert('幸运转盘（阶段D）')}>转盘</button>
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
    </div>
  )
}
