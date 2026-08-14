// 开局 3-2-1 倒计时覆盖层：金色毛笔数字依次跳动，结束回调 onDone。
import { useEffect, useState } from 'react'

export function StartCountdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3)
  useEffect(() => {
    if (n <= 0) {
      onDone()
      return
    }
    const t = setTimeout(() => setN((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [n, onDone])
  if (n <= 0) return null
  return (
    <div className="start-countdown">
      <span key={n} className="start-num">{n}</span>
    </div>
  )
}
