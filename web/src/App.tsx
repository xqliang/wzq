import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { ensureGuest } from './net/rest'
import type { User } from './net/rest'
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
  useEffect(() => {
    ensureGuest().then(setUser).catch(console.error)
  }, [])
  if (!user) return <div className="loading">加载中…</div>
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
      </Routes>
    </BrowserRouter>
  )
}
