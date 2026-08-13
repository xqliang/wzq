import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { endgameLevels } from '../net/rest'
import type { EndgameMeta } from '../net/rest'
import { playSfx } from '../audio/audio'

// 残局闯关 - 关卡列表页：按章节分组展示关卡，难度以 ★ 表示，已通关关卡打勾高亮。
export function Endgame() {
  const nav = useNavigate()
  const [levels, setLevels] = useState<EndgameMeta[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    endgameLevels()
      .then(setLevels)
      .catch((e) => setErr(String(e)))
  }, [])

  // 打开某一关：跳转到对局页。
  const openLevel = (id: string) => {
    playSfx('button')
    nav(`/endgame/play/${id}`)
  }

  // 按章节分组（保持后端返回顺序）。
  const chapters = groupByChapter(levels ?? [])

  return (
    <div className="endgame screen">
      <header className="endgame-head">
        <button onClick={() => nav('/')}>← 返回</button>
        <h2>残局闯关</h2>
      </header>
      {err && <p className="tip">加载失败：{err}</p>}
      {!levels && !err && <p>加载中…</p>}
      {chapters.map(([chapter, list]) => (
        <section key={chapter} className="endgame-chapter">
          <h3>第 {chapter} 章</h3>
          <div className="endgame-grid">
            {list.map((lv) => (
              <button
                key={lv.id}
                className={`endgame-cell${lv.passed ? ' passed' : ''}`}
                onClick={() => openLevel(lv.id)}
                title={lv.name}
              >
                <span className="lv-id">{lv.id}</span>
                <span className="lv-stars">{'★'.repeat(lv.difficulty)}</span>
                {lv.passed && <span className="lv-check">✓</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// 将扁平关卡列表按 chapter 分组，返回 [chapter, 关卡[]] 的有序数组。
function groupByChapter(levels: EndgameMeta[]): [number, EndgameMeta[]][] {
  const map = new Map<number, EndgameMeta[]>()
  for (const lv of levels) {
    const arr = map.get(lv.chapter) ?? []
    arr.push(lv)
    map.set(lv.chapter, arr)
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0])
}
