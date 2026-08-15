import { useEffect, useState } from 'react'
import { img } from '../lib/asset'
import { useNavigate } from 'react-router-dom'
import { checkinState, checkinClaim } from '../net/rest'
import type { CheckinState, Reward } from '../net/rest'
import { GamePanel } from '../components/GamePanel'
import { playSfx } from '../audio/audio'

// 奖励图标：金币/卷轴用货币图标，item（特级棋盘）用奖章占位。
function rewardIcon(r: Reward): string {
  if (r.kind === 'scrolls') return img('icon_scroll')
  if (r.kind === 'item') return img('medal_master')
  return img('icon_coin')
}

// 每日签到页：7 天奖励（前 6 天网格 + 第 7 天大奖横条），支持普通/看广告双倍领取。
export function Checkin() {
  const nav = useNavigate()
  const [st, setSt] = useState<CheckinState | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    checkinState().then(setSt).catch(() => setMsg('加载失败'))
  }, [])

  const claim = (double: boolean) => {
    setBusy(true)
    setMsg('')
    checkinClaim(double)
      .then((r) => {
        setSt(r.state)
        setMsg(`获得 ${r.reward.label}${double ? '（双倍）' : ''}`)
        playSfx('win')
      })
      .catch(() => setMsg('今日已签到'))
      .finally(() => setBusy(false))
  }

  if (!st) return <div className="loading">{msg || '加载中…'}</div>
  return (
    <GamePanel title="每日签到" onClose={() => nav('/')}>
      <div className="checkin-grid">
        {st.rewards.slice(0, 6).map((r, i) => (
          <div
            key={i}
            className={`checkin-cell${i < st.streak ? ' done' : ''}${i === st.dayIndex && !st.claimed ? ' today' : ''}`}
          >
            <div className="checkin-day">第{i + 1}天</div>
            <img className="checkin-icon" src={rewardIcon(r)} alt="" />
            <div className="checkin-amt">{r.kind === 'item' ? r.label : `×${r.amount}`}</div>
          </div>
        ))}
      </div>
      <div className="checkin-day7">
        <div>
          <div className="checkin-day7-title">第七天</div>
          <div className="checkin-day7-desc">累计登录 7 天，获取神秘大奖</div>
        </div>
        <img src={img('medal_master')} className="checkin-chest" alt="" />
      </div>
      {msg && <p className="tip">{msg}</p>}
      <div className="checkin-actions">
        <button className="op-btn" disabled={busy || st.claimed} onClick={() => claim(false)}>
          {st.claimed ? '今日已领' : '领取奖励'}
        </button>
        <button className="ad-double" disabled={busy || st.claimed} onClick={() => claim(true)}>
          ▶ 双倍领取
        </button>
      </div>
    </GamePanel>
  )
}
