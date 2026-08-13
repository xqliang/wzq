import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ensureGuest } from './net/rest'
import type { User } from './net/rest'
import { Home } from './pages/Home'
import { AiConfig } from './pages/AiConfig'
import { Game } from './pages/Game'
import { Result } from './pages/Result'
import { Room } from './pages/Room'
import { Endgame } from './pages/Endgame'
import { EndgamePlay } from './pages/EndgamePlay'

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
        <Route path="/game" element={<Game />} />
        <Route path="/result" element={<Result />} />
        <Route path="/room/:id?" element={<Room />} />
        <Route path="/endgame" element={<Endgame />} />
        <Route path="/endgame/play/:id" element={<EndgamePlay />} />
      </Routes>
    </BrowserRouter>
  )
}
