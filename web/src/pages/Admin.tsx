import { useEffect, useState } from 'react'
import {
  adminLogin,
  adminLoggedIn,
  adminLogout,
  adminOverview,
  adminUsers,
  adminGames,
} from '../net/rest'
import type { AdminOverview, AdminUser, AdminGame } from '../net/rest'

// 运营后台页：口令登录后展示概览指标 + 最近用户 / 最近对局两张表。
// 仅凭 URL 直达，不从首页外链（属运营页面）。
export function Admin() {
  const [logged, setLogged] = useState(adminLoggedIn())
  const [pw, setPw] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [games, setGames] = useState<AdminGame[]>([])
  const [loadErr, setLoadErr] = useState('')

  // 加载全部后台数据；令牌过期（401）则清除令牌回到登录态。
  const load = () => {
    setLoadErr('')
    Promise.all([adminOverview(), adminUsers(), adminGames()])
      .then(([ov, us, gs]) => {
        setOverview(ov)
        setUsers(us)
        setGames(gs)
      })
      .catch((e: Error) => {
        if (e.message === '401') {
          adminLogout()
          setLogged(false)
        } else {
          setLoadErr('数据加载失败')
        }
      })
  }

  useEffect(() => {
    if (logged) load()
  }, [logged])

  // 提交口令登录。
  const doLogin = async () => {
    setLoginErr('')
    try {
      await adminLogin(pw)
      setPw('')
      setLogged(true)
    } catch (e) {
      setLoginErr((e as Error).message === '401' ? '密码错误' : '登录失败')
    }
  }

  // 退出后台。
  const doLogout = () => {
    adminLogout()
    setOverview(null)
    setUsers([])
    setGames([])
    setLogged(false)
  }

  if (!logged) {
    return (
      <div className="admin-login screen">
        <h2 className="admin-title">运营后台</h2>
        <input
          className="admin-input"
          type="password"
          placeholder="管理口令"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doLogin()}
        />
        <button className="entry primary" onClick={doLogin}>
          登录
        </button>
        {loginErr && <div className="tip">{loginErr}</div>}
      </div>
    )
  }

  // 概览卡片项。
  const cards: [string, number][] = overview
    ? [
        ['用户总数', overview.users],
        ['今日新增', overview.todayNewUsers],
        ['人机对局', overview.gamesAI],
        ['真人对局', overview.gamesPvP],
        ['残局通关', overview.endgamePasses],
      ]
    : []

  return (
    <div className="admin screen">
      <div className="admin-header">
        <h2 className="admin-title">运营后台</h2>
        <button className="admin-logout" onClick={doLogout}>
          退出
        </button>
      </div>

      {loadErr && <div className="tip">{loadErr}</div>}

      <div className="admin-cards">
        {cards.map(([label, value]) => (
          <div className="admin-card" key={label}>
            <div className="admin-card-value">{value}</div>
            <div className="admin-card-label">{label}</div>
          </div>
        ))}
      </div>

      <h3 className="admin-subtitle">最近用户</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>昵称</th>
              <th>等级</th>
              <th>经验</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.nickname}</td>
                <td>Lv.{u.level}</td>
                <td>{u.exp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="admin-subtitle">最近对局</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>模式</th>
              <th>AI难度</th>
              <th>胜方</th>
              <th>手数</th>
              <th>结束</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.id}>
                <td>{g.id}</td>
                <td>{g.mode}</td>
                <td>{g.mode === 'ai' ? g.aiLevel : '-'}</td>
                <td>{g.winner || '-'}</td>
                <td>{g.moves}</td>
                <td>{g.endReason || '-'}</td>
                <td>{g.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
