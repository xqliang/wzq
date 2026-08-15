import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { BoardCanvas } from '../board/BoardCanvas'
import type { Overlay } from '../board/BoardCanvas'
import { ResultModal } from '../components/ResultModal'
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
  // 记录请求 AI 的起始时刻，用于把"思考"总时长控制在 1~2s。
  const aiStartRef = useRef(0)
  // 待展示的结算结果：先算出但不立刻置 done，等获胜连线动画播放完再置（无连线则立即置）。
  const pendingDoneRef = useRef<Done>(null)

  // 订阅轮次与胜负，驱动 AI 落子与结算。
  const turn = useGame((s) => s.turn)
  const winner = useGame((s) => s.winner)

  // 创建 AI Worker（仅一次）：收到落子后延时到 1~2s 再以防守方颜色落子并播放音效。
  useEffect(() => {
    const w = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' })
    w.onmessage = (e: MessageEvent<{ x: number; y: number }>) => {
      const wait = Math.max(0, 1000 + Math.random() * 1000 - (performance.now() - aiStartRef.current))
      window.setTimeout(() => {
        const st = useGame.getState()
        if (st.winner) return // 已分胜负，丢弃迟到结果
        const defender: Color = st.myColor === 'black' ? 'white' : 'black'
        st.place(e.data.x, e.data.y, defender)
        playSfx('place')
      }, wait)
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
    pendingDoneRef.current = null
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
    aiStartRef.current = performance.now()
    workerRef.current?.postMessage({ board, color: defender, level: 3 })
  }, [turn, winner, done, detail])

  // 胜负结算：任一落子后 winner 变化即判定并上报服务端；
  // 若存在获胜连线，先让 BoardCanvas 播放高亮动画，动画结束回调再置 done（展示弹窗）；
  // 无连线则立即置 done。
  useEffect(() => {
    if (!winner || done || pendingDoneRef.current || !detail) return
    const outcome: Done = winner === detail.toMove ? 'win' : 'lose'
    pendingDoneRef.current = outcome
    playSfx(outcome === 'win' ? 'win' : 'lose')
    endgameComplete(id, outcome === 'win').catch(() => {})
    if (!useGame.getState().winLine) setDone(outcome)
  }, [winner, done, detail, id])

  // 确认落子：按当前轮次（此时为玩家）落子。
  const onConfirm = () => {
    if (done || useGame.getState().winner) return
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
    pendingDoneRef.current = null
    setOverlays(undefined)
  }

  if (err) {
    return (
      <div className="endgame screen">
        <p className="tip">出错了：{err}</p>
        <button className="back-btn" onClick={() => nav('/endgame')}>返回列表</button>
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
      <BoardCanvas
        onConfirm={onConfirm}
        overlays={overlays}
        interactive={!done}
        onWinAnimationEnd={() => setDone(pendingDoneRef.current)}
      />
      <div className="hud">
        {done === null && (
          <>
            <button onClick={onHint}>💡 提示</button>
            <button onClick={retry}>重试</button>
            <button className="back-btn" onClick={() => nav('/endgame')}>返回列表</button>
          </>
        )}
      </div>
      {done && (
        <ResultModal
          win={done === 'win'}
          title={done === 'win' ? '🎉 挑战成功' : '本局失败'}
          lines={done === 'win' ? ['成功通关本局残局'] : ['被翻盘了，再试一次']}
          actions={
            done === 'win'
              ? [
                  ...(nextId
                    ? [
                        {
                          label: '下一关',
                          primary: true,
                          onClick: () => {
                            playSfx('button')
                            nav(`/endgame/play/${nextId}`)
                          },
                        },
                      ]
                    : []),
                  { label: '返回列表', onClick: () => nav('/endgame') },
                ]
              : [
                  { label: '重试', primary: true, onClick: retry },
                  { label: '返回列表', onClick: () => nav('/endgame') },
                ]
          }
        />
      )}
    </div>
  )
}
