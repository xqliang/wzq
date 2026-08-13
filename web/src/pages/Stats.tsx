import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { myStats } from '../net/rest'
import type { Stats as StatsData } from '../net/rest'

// 战绩页：展示我的对局统计，并支持一键复制分享链接。
export function Stats() {
  const nav = useNavigate()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [me, setMe] = useState<{ id: number; nickname: string; level: number } | null>(null)
  const [err, setErr] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    myStats()
      .then((r) => {
        setStats(r.stats)
        setMe(r.user)
      })
      .catch(() => setErr(true))
  }, [])

  // 生成分享链接并写入剪贴板，短暂提示“已复制”。
  const share = async () => {
    if (!me) return
    const url = `${location.origin}/share/${me.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // 剪贴板不可用（如非安全上下文）时，退化为提示用户手动复制。
      window.prompt('复制此链接分享战绩', url)
    }
  }

  if (err) {
    return (
      <div className="stats screen">
        <p className="tip">战绩加载失败</p>
        <button className="entry" onClick={() => nav('/')}>
          返回首页
        </button>
      </div>
    )
  }
  if (!stats || !me) return <div className="loading">加载中…</div>

  // 统计项：标签 + 数值，网格排列。
  const items: [string, string | number][] = [
    ['对局数', stats.total],
    ['胜', stats.wins],
    ['负', stats.losses],
    ['胜率', `${stats.winRate}%`],
    ['当前连胜', stats.streak],
    ['人机 · 真人', `${stats.aiGames} · ${stats.pvpGames}`],
  ]

  return (
    <div className="stats screen">
      <h2 className="stats-title">
        「{me.nickname}」 Lv.{me.level}
      </h2>
      <div className="stats-grid">
        {items.map(([label, value]) => (
          <div className="stat-card" key={label}>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>
      <button className="entry primary" onClick={share}>
        分享战绩
      </button>
      {copied && <div className="tip">已复制</div>}
      <button className="entry" onClick={() => nav('/')}>
        返回首页
      </button>
    </div>
  )
}
