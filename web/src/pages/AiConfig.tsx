import { useNavigate } from 'react-router-dom'
import type { User } from '../net/rest'
import { Banner } from '../components/Banner'

// 三档人机难度配置：奖章/描述用于古风卡片展示。
const LEVELS = [
  { lv: 1, name: '普通练习', cost: 0, medal: 'medal_ji', desc: '轻松热身，稳扎稳打' },
  { lv: 2, name: '中等', cost: 50, medal: 'medal_duan', desc: '攻守兼备，略有挑战' },
  { lv: 3, name: '高级', cost: 100, medal: 'medal_master', desc: '棋力精进，全力应战' },
]

// 人机难度选择页：古风木牌卡片，经验不足时锁定高档；选择后进入对局并携带 mode/level。
export function AiConfig({ user }: { user: User }) {
  const nav = useNavigate()
  return (
    <div className="ai-config screen">
      <Banner text="选择难度" tone="gold" />
      <div className="level-list">
        {LEVELS.map((l) => {
          const locked = user.exp < l.cost
          return (
            <button
              key={l.lv}
              className={`level-card${locked ? ' locked' : ''}`}
              disabled={locked}
              onClick={() => nav('/game', { state: { mode: 'ai', level: l.lv, cost: l.cost } })}
            >
              <img className="level-medal" src={`/assets/img/${l.medal}.png`} alt="" />
              <span className="level-main">
                <span className="level-name">{l.name}</span>
                <span className="level-desc">{l.desc}</span>
              </span>
              <span className="level-meta">
                <span>{locked ? `需经验 ${l.cost}` : l.cost ? `消耗 ${l.cost}` : '免费'}</span>
                <em>胜 +20</em>
              </span>
            </button>
          )
        })}
      </div>
      <p className="exp-hint">当前经验 {user.exp}</p>
      <button className="back-btn" onClick={() => nav('/')}>返回</button>
    </div>
  )
}
