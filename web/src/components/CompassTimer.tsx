// 罗盘倒计时：圆盘中央显示剩余秒，外圈弧随剩余比例收缩；level 控制颜色。
// 纯展示，remain/progress/level 由父组件用 countdownState 计算后传入。
import type { CountdownLevel } from '../lib/countdown'

export function CompassTimer({
  remain,
  progress,
  level,
}: {
  remain: number
  progress: number
  level: CountdownLevel
}) {
  const R = 26
  const C = 2 * Math.PI * R
  const color = level === 'danger' ? '#c0392b' : level === 'warn' ? '#d97706' : '#c8912f'
  return (
    <div className={`compass compass-${level}`}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={R} fill="rgba(58,44,26,0.85)" stroke="#c8912f" strokeWidth="3" />
        <circle
          cx="32" cy="32" r={R} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
          transform="rotate(-90 32 32)" strokeLinecap="round"
        />
        <text x="32" y="38" textAnchor="middle" fontSize="22" fontWeight="700" fill="#f6ecd8">
          {remain}
        </text>
      </svg>
    </div>
  )
}
