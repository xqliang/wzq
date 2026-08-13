import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { shareStats } from '../net/rest'

// 分享页：公开的炫耀战绩卡片，任何人可访问（无需登录）。
export function Share() {
  const nav = useNavigate()
  const { uid } = useParams()
  const [data, setData] = useState<{
    nickname: string
    level: number
    wins: number
    streak: number
    total: number
  } | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    const id = Number(uid)
    if (!uid || Number.isNaN(id)) {
      setErr(true)
      return
    }
    shareStats(id)
      .then(setData)
      .catch(() => setErr(true))
  }, [uid])

  if (err) {
    return (
      <div className="share screen">
        <div className="share-card">
          <p className="tip">战绩不存在或加载失败</p>
        </div>
        <button className="entry primary" onClick={() => nav('/')}>
          我也来下一盘
        </button>
      </div>
    )
  }
  if (!data) return <div className="loading">加载中…</div>

  return (
    <div className="share screen">
      <div className="share-card">
        <div className="share-brag">
          「{data.nickname}」 Lv.{data.level}
        </div>
        <div className="share-line">
          已胜 {data.wins} 局 · 当前连胜 {data.streak}
        </div>
        <div className="share-sub">共战 {data.total} 局</div>
      </div>
      <button className="entry primary" onClick={() => nav('/')}>
        我也来下一盘
      </button>
    </div>
  )
}
