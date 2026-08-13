import { useNavigate } from 'react-router-dom'
import type { User } from '../net/rest'

// 首页：展示用户信息与对战入口。
export function Home({ user }: { user: User }) {
  const nav = useNavigate()
  return (
    <div className="home screen">
      <header className="profile">
        <img src={`/assets/img/${user.avatar}.png`} alt="" className="avatar" />
        <div>
          <div className="nick">{user.nickname}</div>
          <div className="exp">
            经验 {user.exp} · Lv.{user.level}
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
        <button className="entry" onClick={() => nav('/room')}>
          好友对战
        </button>
        <button className="entry" onClick={() => nav('/endgame')}>
          残局闯关
        </button>
      </main>
    </div>
  )
}
