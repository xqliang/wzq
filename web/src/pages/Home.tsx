import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { me, matchJoin } from '../net/rest'
import type { User } from '../net/rest'
import { rankLabel } from '../theme/ranks'
import { Avatar } from '../components/Avatar'

// 首页：LOGO + 资料/货币占位条 + 对战入口 + 运营入口（商店/签到/转盘占位）。
export function Home({ user }: { user: User }) {
  const nav = useNavigate()
  const [u, setU] = useState<User>(user)
  useEffect(() => {
    me().then(setU).catch(() => {})
  }, [])
  // 阶段 A 占位：用 level 粗映射一个段位索引展示（B 阶段接真实 rank_tier）。
  const placeholderTier = Math.min(18, (u.level ?? 1) - 1)
  return (
    <div className="home screen">
      <img src="/assets/img/logo_title.png" alt="五子棋" className="home-logo" />
      <header className="profile">
        <Avatar src={`/assets/img/${u.avatar}.png`} size={60} />
        <div>
          <div className="nick">{u.nickname}</div>
          <div className="rank-tag">{rankLabel(placeholderTier)}</div>
        </div>
        <div className="currency">
          <span className="coin"><img src="/assets/img/icon_coin.png" alt="金币" />0</span>
          <span className="scroll"><img src="/assets/img/icon_scroll.png" alt="卷轴" />0</span>
        </div>
        <button className="settings-btn" onClick={() => nav('/settings')}>⚙️</button>
      </header>
      <main className="entries">
        <button className="entry" onClick={() => nav('/ai')}>人机对战</button>
        <button
          className="entry primary"
          onClick={() =>
            matchJoin()
              .then((r) => nav('/game', { state: { mode: 'pvp', roomId: r.roomId } }))
              .catch(() => {})
          }
        >随机匹配</button>
        <button className="entry" onClick={() => nav('/room')}>好友对战</button>
        <button className="entry" onClick={() => nav('/endgame')}>残局闯关</button>
        <button className="entry" onClick={() => nav('/stats')}>我的战绩</button>
      </main>
      <nav className="ops-row">
        <button className="op-btn" onClick={() => alert('商店（阶段C）')}>商店</button>
        <button className="op-btn" onClick={() => alert('每日签到（阶段D）')}>签到</button>
        <button className="op-btn" onClick={() => alert('幸运转盘（阶段D）')}>转盘</button>
      </nav>
    </div>
  )
}
