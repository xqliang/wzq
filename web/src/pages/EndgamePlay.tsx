import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BoardCanvas } from '../board/BoardCanvas'
import type { Overlay } from '../board/BoardCanvas'
import { useGame } from '../store/game'
import { playSfx } from '../audio/audio'
import { endgameLevel, endgameLevels, endgameHint, endgameComplete } from '../net/rest'
import type { EndgameDetail } from '../net/rest'
import { emptyBoard } from '../core/types'
import type { Board, Color } from '../core/types'
import { applyMove } from '../core/board'

// 闯关结果：null=进行中，'win'=玩家取胜，'lose'=被 AI 翻盘。
type Done = null | 'win' | 'lose'

// 由预置棋子构建初始棋盘。
function buildBoard(stones: EndgameDetail['stones']): Board {
  let board = emptyBoard()
  for (const s of stones) board = applyMove(board, { x: s.x, y: s.y, color: s.color })
  return board
}

// 残局闯关 - 对局页：加载预置局面后，玩家（黑）与 AI（白，防守方）接着对弈，
// 直到一方连五。玩家取胜即通关，被翻盘则失败，可重试。
export function EndgamePlay() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [detail, setDetail] = useState<EndgameDetail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<Done>(null)
  const [overlays, setOverlays] = useState<Overlay[] | undefined>(undefined)
  const [nextId, setNextId] = useState<string | null>(null)
  // AI Web Worker：在后台线程计算防守方落子，避免卡顿主线程。
  const workerRef = useRef<Worker | null>(null)

  // 订阅轮次与胜负，驱动 AI 落子与结算。
  const turn = useGame((s) => s.turn)
  const winner = useGame((s) => s.winner)

  // 创建 AI Worker（仅一次）：收到落子后以防守方颜色落子并播放音效。
  useEffect(() => {
    const w = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ x: number; y: number }>) => {
      const st = useGame.getState()
      if (st.winner) return // 已分胜负，丢弃迟到结果
      const defender: Color = st.myColor === 'black' ? 'white' : 'black'
      st.place(e.data.x, e.data.y, defender)
      playSfx('place')
    }
    workerRef.current = w
    return () => w.terminate()
  }, [])

  // 加载关卡：构建初始棋盘并注入 store；同时拉取列表以推导下一关（列表已按难度排序）。
  useEffect(() => {
    if (!id) return
    setDetail(null)
    setErr(null)
    setDone(null)
    setOverlays(undefined)
    endgameLevel(id)
      .then((d) => {
        useGame.getState().setup(buildBoard(d.stones), d.toMove)
        setDetail(d)
      })
      .catch((e) => setErr(String(e)))
    endgameLevels()
      .then((list) => {
        const i = list.findIndex((l) => l.id === id)
        setNextId(i >= 0 && i + 1 < list.length ? list[i + 1].id : null)
      })
      .catch(() => setNextId(null))
  }, [id])

  // 防守方（AI）回合驱动：轮到防守方且未分胜负、未结束时，请 Worker 计算落子。
  useEffect(() => {
    if (!detail || done || winner) return
    const defender: Color = detail.toMove === 'black' ? 'white' : 'black'
    if (turn !== defender) return
    const board = useGame.getState().board
    workerRef.current?.postMessage({ board, color: defender, level: 3 })
  }, [turn, winner, done, detail])

  // 胜负结算：任一落子后 winner 变化即判定，并上报服务端（首胜奖励经验）。
  useEffect(() => {
    if (!winner || done || !detail) return
    if (winner === detail.toMove) {
      playSfx('win')
      setDone('win')
      endgameComplete(id, true).catch(() => {})
    } else {
      playSfx('lose')
      setDone('lose')
      endgameComplete(id, false).catch(() => {})
    }
  }, [winner, done, detail, id])

  // 确认落子：按当前轮次（此时为玩家）落子。
  const onConfirm = () => {
    if (done) return
    useGame.getState().confirm()
    playSfx('place')
  }

  // 💡 提示：高亮推荐落子（当前局面的一个可接受首着）。
  const onHint = () => {
    playSfx('button')
    endgameHint(id)
      .then((h) => setOverlays([{ x: h.x, y: h.y, color: '#f1c40f', label: '★' }]))
      .catch((e) => setErr(String(e)))
  }

  // 重试：恢复初始局面、清除结果与提示。
  const retry = () => {
    if (!detail) return
    playSfx('button')
    useGame.getState().setup(buildBoard(detail.stones), detail.toMove)
    setDone(null)
    setOverlays(undefined)
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

  const myTurn = turn === detail.toMove
  const who = detail.toMove === 'black' ? '黑' : '白'

  return (
    <div className="endgame-play screen game">
      <div className="endgame-prompt">
        <span className="lv-id">残局 {detail.id}</span>
        <span className="lv-stars">{'★'.repeat(detail.difficulty)}</span>
        <span className="tip">
          {detail.steps}步可胜 ·{' '}
          {done ? '对局结束' : myTurn ? `轮到你(${who})` : 'AI 思考中…'}
        </span>
      </div>
      <BoardCanvas onConfirm={onConfirm} overlays={overlays} interactive={!done} />
      <div className="hud">
        {done === null && (
          <>
            <button onClick={onHint}>💡 提示</button>
            <button onClick={retry}>重试</button>
            <button onClick={() => nav('/endgame')}>返回列表</button>
          </>
        )}
        {done === 'win' && (
          <>
            <span className="tip">🎉 挑战成功！</span>
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
        {done === 'lose' && (
          <>
            <span className="tip">❌ 被翻盘了，再试一次</span>
            <button onClick={retry}>重试</button>
            <button onClick={() => nav('/endgame')}>返回列表</button>
          </>
        )}
      </div>
    </div>
  )
}
