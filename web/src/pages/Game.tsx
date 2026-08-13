import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BoardCanvas } from '../board/BoardCanvas'
import { useGame } from '../store/game'
import { playSfx } from '../audio/audio'
import { reportAiResult, getCurrentUser } from '../net/rest'
import { connectRoom, sendMove, sendUndoReq, sendUndoReply, sendResign } from '../net/ws'
import type { ServerMsg } from '../net/ws'
import type { Color } from '../core/types'

// 对局页：人机模式驱动 AI Web Worker；真人模式持有唯一的 WebSocket 连接。
export function Game() {
  const loc = useLocation() as {
    state?: { mode: string; level?: number; roomId?: string }
  }
  const nav = useNavigate()
  const st = loc.state ?? { mode: 'ai', level: 1 }
  const g = useGame()
  const workerRef = useRef<Worker | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const [remain, setRemain] = useState(60)
  // 真人模式在收到服务端 start 前处于等待态。
  const [started, setStarted] = useState(st.mode === 'ai')

  // 处理服务端消息。内部一律用 useGame.getState() 读取最新状态，避免闭包过期。
  function handleServer(m: ServerMsg) {
    const store = useGame.getState()
    const myUid = getCurrentUser()?.id
    switch (m.type) {
      case 'start': {
        // 服务端指派我方颜色，据此重置对局。
        store.reset(m.color ?? 'black')
        setStarted(true)
        break
      }
      case 'move': {
        // 只有对手的落子才需要写盘（自己的已在 confirm 时本地落下）。
        if (m.uid !== undefined && m.uid !== myUid && m.x !== undefined && m.y !== undefined) {
          const oppColor: Color = store.myColor === 'black' ? 'white' : 'black'
          store.place(m.x, m.y, oppColor)
          playSfx('place')
        }
        break
      }
      case 'turn': {
        setDeadline(m.deadline ?? null)
        break
      }
      case 'undo_req': {
        // 对手发起悔棋：本地弹窗询问，回应服务端。
        const agree = window.confirm('对方请求悔棋，是否同意？')
        if (wsRef.current) sendUndoReply(wsRef.current, agree)
        break
      }
      case 'game_over': {
        nav('/result', { state: { win: m.winner === myUid ? 1 : 0, reason: m.reason } })
        break
      }
    }
  }

  // 初始化：人机建 Worker；真人连 WS。
  useEffect(() => {
    if (st.mode === 'ai') {
      g.reset('black')
      workerRef.current = new Worker(new URL('../ai/worker.ts', import.meta.url), { type: 'module' })
      workerRef.current.onmessage = (e: MessageEvent<{ x: number; y: number; color: Color }>) => {
        useGame.getState().place(e.data.x, e.data.y, 'white')
        playSfx('place')
      }
    } else if (st.roomId) {
      g.reset('black') // 占位，start 消息到达后会按指派颜色再次重置
      wsRef.current = connectRoom(st.roomId, handleServer)
    }
    return () => {
      workerRef.current?.terminate()
      wsRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 人机模式：轮到 AI（白）且未分胜负时请求 Worker 计算。
  useEffect(() => {
    if (st.mode === 'ai' && g.turn === 'white' && !g.winner) {
      workerRef.current?.postMessage({ board: g.board, color: 'white', level: st.level })
    }
  }, [g.turn, g.winner, g.board, st.mode, st.level])

  // 胜负结算：播放音效；人机模式上报结果并跳转（真人由 game_over 跳转）。
  useEffect(() => {
    if (!g.winner) return
    const win = g.winner === g.myColor
    playSfx(win ? 'win' : 'lose')
    if (st.mode === 'ai') {
      reportAiResult(st.level ?? 1, win).then((r) =>
        nav('/result', { state: { win, expDelta: r.expDelta } }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.winner])

  // 真人回合倒计时：每 250ms 计算剩余秒数，≤5s 播放滴答提示。
  useEffect(() => {
    if (deadline == null) return
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemain(s)
      if (s <= 5 && s > 0) playSfx('tick')
    }, 250)
    return () => clearInterval(t)
  }, [deadline])

  // 确认落子：本地落子 + 音效；真人模式同时上报服务端。
  const onConfirm = () => {
    const p = g.pending
    if (!p) return
    g.confirm()
    playSfx('place')
    if (st.mode === 'pvp' && wsRef.current) sendMove(wsRef.current, p.x, p.y)
  }

  if (!started) {
    return (
      <div className="game screen">
        <p>等待对手加入…</p>
        <button onClick={() => nav('/')}>退出</button>
      </div>
    )
  }

  return (
    <div className="game screen">
      <div className="player opponent">对手 {st.mode === 'ai' ? 'AI大师 ⚪' : '⚪'}</div>
      <BoardCanvas onConfirm={onConfirm} />
      <div className="hud">
        {g.turn === g.myColor ? <span className="tip">轮到你落子</span> : <span>对方思考中…</span>}
        {st.mode === 'pvp' && <span className={remain <= 10 ? 'warn' : ''}>{remain}s</span>}
        {g.pending && <button onClick={onConfirm}>✓ 确认</button>}
        {g.pending && <button onClick={() => g.cancel()}>取消</button>}
        {st.mode === 'pvp' && wsRef.current && (
          <>
            <button onClick={() => sendUndoReq(wsRef.current!)}>悔棋</button>
            <button onClick={() => sendResign(wsRef.current!)}>认输</button>
          </>
        )}
      </div>
    </div>
  )
}
