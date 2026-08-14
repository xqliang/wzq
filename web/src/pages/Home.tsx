import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { me, matchJoin } from '../net/rest'
import type { User } from '../net/rest'

// 首页：展示用户信息与对战入口。每次进入刷新经验/等级（对局后回到首页即时更新）。
export function Home({ user }: { user: User }) {
  const nav = useNavigate()
  const [u, setU] = useState<User>(user)
  useEffect(() => {
    me().then(setU).catch(() => {})
  }, [])
  return (
    <div className="home screen">
      <header className="profile">
        <img src={`/assets/img/${u.avatar}.png`} alt="" className="avatar" />
        <div>
          <div className="nick">{u.nickname}</div>
          <div className="exp">
            经验 {u.exp} · Lv.{u.level}
          </div>
        </div>
        <button className="settings-btn" onClick={() => nav('/settings')}>
          ⚙️
        </button>
      </header>
      <main className="entries">
        <button className="entry" onClick={() => nav('/ai')}>
          人机对战
        </button>
        <button
          className="entry primary"
          onClick={() =>
            matchJoin()
              .then((r) => nav('/game', { state: { mode: 'pvp', roomId: r.roomId } }))
              .catch(() => {})
          }
        >
          随机匹配
        </button>
        <button className="entry" onClick={() => nav('/room')}>
          好友对战
        </button>
        <button className="entry" onClick={() => nav('/endgame')}>
          残局闯关
        </button>
        <button className="entry" onClick={() => nav('/stats')}>
          我的战绩
        </button>
      </main>
    </div>
  )
}
