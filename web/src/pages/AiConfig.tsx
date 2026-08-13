import { useNavigate } from 'react-router-dom'
import type { User } from '../net/rest'

// 三档人机难度配置。
const LEVELS = [
  { lv: 1, name: '普通练习', cost: 0 },
  { lv: 2, name: '中等', cost: 50 },
  { lv: 3, name: '高级', cost: 100 },
]

// 人机难度选择页：经验不足时禁用高档，选择后进入对局并携带 mode/level。
export function AiConfig({ user }: { user: User }) {
  const nav = useNavigate()
  return (
    <div className="ai-config screen">
      <h2>选择难度</h2>
      {LEVELS.map((l) => (
        <button
          key={l.lv}
          className="level-card"
          disabled={user.exp < l.cost}
          onClick={() => nav('/game', { state: { mode: 'ai', level: l.lv, cost: l.cost } })}
        >
          <span>{l.name}</span>
          <span>
            当前经验 {user.exp} · 消耗 {l.cost} · 胜利 +20
          </span>
        </button>
      ))}
      <button onClick={() => nav('/')}>返回</button>
    </div>
  )
}
