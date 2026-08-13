import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BoardCanvas } from '../board/BoardCanvas'
import type { Overlay } from '../board/BoardCanvas'
import { useGame } from '../store/game'
import { playSfx } from '../audio/audio'
import {
  endgameLevel,
  endgameLevels,
  endgameSubmit,
  endgameHint,
  endgameAnswer,
} from '../net/rest'
import type { EndgameDetail } from '../net/rest'
import { emptyBoard } from '../core/types'
import type { Board, Color } from '../core/types'
import { applyMove } from '../core/board'

// 提交结果状态：null=未提交/可继续尝试，'correct'=已解出，'wrong'=本次落子错误。
type Verdict = null | 'correct' | 'wrong'

// 残局闯关 - 对局页：加载预置局面，玩家预落子后确认并提交给服务端判定正误。
export function EndgamePlay() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [detail, setDetail] = useState<EndgameDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<Verdict>(null)
  // 覆盖标记：提示（黄★）或答案（绿圈）。
  const [overlays, setOverlays] = useState<Overlay[] | undefined>(undefined)
  // 下一关 id（从关卡列表顺序推导）。
  const [nextId, setNextId] = useState<string | null>(null)
  // 订阅预落子状态，用于控制“确认/取消”按钮的显隐（保证响应式重渲染）。
  const pending = useGame((s) => s.pending)

  // 加载关卡：构建预置棋盘并注入 store；同时拉取列表以推导下一关。
  useEffect(() => {
    if (!id) return
    setDetail(null)
    setErr(null)
    setVerdict(null)
    setOverlays(undefined)
    endgameLevel(id)
      .then((d) => {
        // 逐个应用预置棋子，得到初始局面。
        let board: Board = emptyBoard()
        for (const s of d.stones) board = applyMove(board, { x: s.x, y: s.y, color: s.color })
        useGame.getState().setup(board, d.toMove)
        setDetail(d)
      })
      .catch((e) => setErr(String(e)))
    // 推导下一关：找到当前 id 在列表中的位置，取其后一个。
    endgameLevels()
      .then((list) => {
        const i = list.findIndex((l) => l.id === id)
        setNextId(i >= 0 && i + 1 < list.length ? list[i + 1].id : null)
      })
      .catch(() => setNextId(null))
  }, [id])

  // 确认落子：读取 pending → 提交服务端判定。
  const onConfirm = () => {
    const st = useGame.getState()
    const p = st.pending
    if (!p || !detail) return
    const toMove: Color = detail.toMove
    endgameSubmit(id, p.x, p.y)
      .then((r) => {
        if (r.correct) {
          // 正解：落下这一手让玩家看到，播放胜利音效。
          useGame.getState().place(p.x, p.y, toMove)
          setOverlays(undefined)
          setVerdict('correct')
          playSfx('win')
        } else {
          // 错误：清除预落子，播放失败音效，允许再试。
          useGame.getState().cancel()
          setVerdict('wrong')
          playSfx('lose')
        }
      })
      .catch((e) => setErr(String(e)))
  }

  // 💡 提示：高亮推荐落子。
  const onHint = () => {
    playSfx('button')
    endgameHint(id)
      .then((h) => setOverlays([{ x: h.x, y: h.y, color: '#f1c40f', label: '★' }]))
      .catch((e) => setErr(String(e)))
  }

  // 查看答案：高亮全部正解坐标。
  const onAnswer = () => {
    playSfx('button')
    endgameAnswer(id)
      .then((a) => setOverlays(a.answers.map(([x, y]) => ({ x, y, color: '#2ecc71' }))))
      .catch((e) => setErr(String(e)))
  }

  // 再试一次：仅清除错误提示，保留局面。
  const retry = () => {
    setVerdict(null)
    playSfx('button')
  }

  if (err) {
    return (
      <div className="endgame screen">
        <p className="tip">出错了：{err}</p>
        <button onClick={() => nav('/endgame')}>返回列表</button>
      </div>
    )
  }
  if (!detail) return <div className="endgame screen">加载中…</div>

  const who = detail.toMove === 'black' ? '黑' : '白'

  return (
    <div className="endgame-play screen game">
      <div className="endgame-prompt">
        <span className="lv-id">{detail.id}</span>
        <span className="lv-stars">{'★'.repeat(detail.difficulty)}</span>
        <span className="tip">轮到{who}棋，找出最佳落子</span>
      </div>
      <BoardCanvas onConfirm={onConfirm} overlays={overlays} interactive={verdict !== 'correct'} />
      <div className="hud">
        {verdict === null && (
          <>
            {pending && <button onClick={onConfirm}>✓ 确认</button>}
            {pending && <button onClick={() => useGame.getState().cancel()}>取消</button>}
            <button onClick={onHint}>💡 查看提示</button>
            <button onClick={onAnswer}>查看答案</button>
          </>
        )}
        {verdict === 'wrong' && (
          <>
            <span className="tip">❌ 落子错误</span>
            <button onClick={retry}>再试一次</button>
            <button onClick={onHint}>💡 查看提示</button>
            <button onClick={onAnswer}>查看答案</button>
          </>
        )}
        {verdict === 'correct' && (
          <>
            <span className="tip">🎉 恭喜，挑战成功！</span>
            {nextId && (
              <button
                onClick={() => {
                  playSfx('button')
                  nav(`/endgame/play/${nextId}`)
                }}
              >
                下一关
              </button>
            )}
            <button onClick={() => nav('/endgame')}>返回列表</button>
          </>
        )}
        {verdict !== 'correct' && <button onClick={() => nav('/endgame')}>返回列表</button>}
      </div>
    </div>
  )
}
