import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { img } from './lib/asset'
import { ensureGuest, shopExpired } from './net/rest'
import type { User, ExpiredItem } from './net/rest'
import { setSettings, startBgm } from './audio/audio'
import type { Effect } from './audio/audio'
import { Home } from './pages/Home'
import { AiConfig } from './pages/AiConfig'
import { Game } from './pages/Game'
import { Result } from './pages/Result'
import { Room } from './pages/Room'
import { Endgame } from './pages/Endgame'
import { EndgamePlay } from './pages/EndgamePlay'
import { Stats } from './pages/Stats'
import { Share } from './pages/Share'
import { Admin } from './pages/Admin'
import { Settings } from './pages/Settings'
import { Shop } from './pages/Shop'
import { Checkin } from './pages/Checkin'
import { Wheel } from './pages/Wheel'
import { ExpiredModal } from './components/ExpiredModal'

// 用 location.key 作为 key 强制重挂载 Game：
// “再来一局”会从 /game 导航到 /game，路由匹配不变不会自动重挂载，
// 借助每次导航生成的新 location.key 触发重挂载，从而干净地重开一局。
function GameRoute() {
  const loc = useLocation()
  return <Game key={loc.key} />
}

// 应用根组件：挂载时确保拥有游客身份，再渲染路由。
export default function App() {
  const [user, setUser] = useState<User | null>(null)
  // 打开游戏时检测到期的已装备外观（超过 7 天有效期），供弹窗提示。
  const [expired, setExpired] = useState<ExpiredItem[] | null>(null)
  useEffect(() => {
    ensureGuest()
      .then((u) => {
        // 同步已装备外观到本地设置：棋盘皮肤驱动对局主题、落子动效驱动特效。
        setSettings({ theme: u.equippedBoard || 'wood', effect: (u.equippedEffect || 'ripple') as Effect })
        setUser(u)
        // 用户就绪后检查外观是否过期（失效项会在此被回退为基础款）。
        shopExpired()
          .then((r) => {
            if (r.items && r.items.length) setExpired(r.items)
          })
          .catch(() => {})
      })
      .catch(console.error)
  }, [])
  // 首次用户手势即启动背景音乐（满足浏览器自动播放策略）；音频元素为模块级单例，
  // 切换页面时 play() 只是续播、不会重头播放，故全程保持连续。
  useEffect(() => {
    const start = () => {
      startBgm()
      window.removeEventListener('pointerdown', start)
    }
    window.addEventListener('pointerdown', start)
    return () => window.removeEventListener('pointerdown', start)
  }, [])
  if (!user)
    // 加载态：与首页同位置预留标题占位 + 转圈，React 接管后填入真实数据，避免标题撑高跳动。
    return (
      <div className="home screen">
        <div className="home-logo-box">
          <img src={img('logo_title')} alt="" className="home-logo" />
        </div>
        <div className="app-loading">加载中…</div>
      </div>
    )
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home user={user} />} />
        <Route path="/ai" element={<AiConfig user={user} />} />
        <Route path="/game" element={<GameRoute />} />
        <Route path="/result" element={<Result />} />
        <Route path="/room/:id?" element={<Room />} />
        <Route path="/endgame" element={<Endgame />} />
        <Route path="/endgame/play/:id" element={<EndgamePlay />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/share/:uid" element={<Share />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/checkin" element={<Checkin />} />
        <Route path="/wheel" element={<Wheel />} />
      </Routes>
      {/* 打开游戏时若有过期外观，弹窗提示并引导前往商城重购（须在 Router 内以便 useNavigate）。 */}
      {expired && <ExpiredModal items={expired} onClose={() => setExpired(null)} />}
    </BrowserRouter>
  )
}
