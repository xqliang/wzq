// 开局 3-2-1 倒计时覆盖层：金色毛笔数字依次跳动，结束回调 onDone。
import { useEffect, useRef, useState } from 'react'

export function StartCountdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3)
  // 用 ref 持有最新 onDone，避免父组件重渲染产生的新引用触发 effect 重启计时器。
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  // 防止 onDone 被重复调用。
  const firedRef = useRef(false)
  useEffect(() => {
    if (n <= 0) {
      if (!firedRef.current) {
        firedRef.current = true
        onDoneRef.current()
      }
      return
    }
    const t = setTimeout(() => setN((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [n])
  if (n <= 0) return null
  return (
    <div className="start-countdown">
      <span key={n} className="start-num">{n}</span>
    </div>
  )
}
