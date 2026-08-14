import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BoardCanvas, type Overlay } from '../board/BoardCanvas'
import { ResultOverlay } from '../components/ResultOverlay'
import { StartCountdown } from '../components/StartCountdown'
import { GameMenu } from '../components/GameMenu'
import { useGame } from '../store/game'
import { playSfx } from '../audio/audio'
import { reportAiResult, getCurrentUser } from '../net/rest'
import { connectRoom, sendMove, sendUndoReq, sendUndoReply, sendResign } from '../net/ws'
import type { ServerMsg } from '../net/ws'
import type { Color } from '../core/types'
import { applyMove } from '../core/board'
import { checkWin } from '../core/win'
import { bestMove } from '../ai/search'
import { countdownState } from '../lib/countdown'
import { PlayerBar, type PlayerInfo } from '../components/PlayerBar'
import { rankLabel } from '../theme/ranks'

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
  const [remain, setRemain] = useState(30)
  // 真人模式在收到服务端 start 前处于等待态。
  const [started, setStarted] = useState(st.mode === 'ai')
  // 开局 3-2-1 倒计时进行中禁止落子（started 后才开始）。
  const [introDone, setIntroDone] = useState(false)
  // AI 提示高亮点（仅人机模式）。
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null)
  // 三步预演的标记；非空即处于预演态（禁用落子，仅展示）。
  const [previewSteps, setPreviewSteps] = useState<Overlay[] | null>(null)
  // 好友对战等待剩余秒数（最多 5 分钟）。
  const [waitLeft, setWaitLeft] = useState(300)
  // 防止重复结算（例如落子与动画/事件竞态）。
  const settledRef = useRef(false)
  // 结算结果与弹窗显隐。result 记录胜负/原因/经验；showModal 控制何时展示（等连线动画播放完）。
  const [result, setResult] = useState<{ win: boolean; reason?: string; expDelta?: number } | null>(
    null,
  )
  const [showModal, setShowModal] = useState(false)
  // 记录本次请求 AI 的起始时刻，用于把"思考"总时长控制在 1~2s（含真实运算耗时）。
  const aiStartRef = useRef(0)

  // 统一结算：只结算一次；播放音效、（人机）上报结果得到经验增量；不再直接跳转。
  // 若当前存在获胜连线（winLine），交由 BoardCanvas 的 onWinAnimationEnd 在动画结束后展示弹窗；
  // 否则（超时/认输，无连线）立即展示弹窗。棋盘始终留在弹窗之后可见。
  const finish = (win: boolean, reason?: string) => {
    if (settledRef.current) return
    settledRef.current = true
    playSfx(win ? 'win' : 'lose')
    if (st.mode === 'ai') {
      reportAiResult(st.level ?? 1, win).then((r) => setResult({ win, reason, expDelta: r.expDelta }))
    } else {
      setResult({ win, reason })
    }
    if (!useGame.getState().winLine) setShowModal(true)
  }

  // 再来一局：按模式重开（导航到 /game，借 location.key 触发重挂载得到全新对局）。
  const rematch = () => {
    if (st.mode === 'pvp' && st.roomId) nav('/game', { state: { mode: 'pvp', roomId: st.roomId } })
    else nav('/game', { state: { mode: 'ai', level: st.level ?? 1 } })
  }

  // 预演双方各再走 3 步（共 6 手）的分步配色（绿/蓝/紫，深浅区分先后）。
  const PREVIEW_COLORS = ['#2ecc71', '#3498db', '#9b59b6', '#27ae60', '#2980b9', '#8e44ad']

  // 💡提示：用 AI 为我方算一手推荐并高亮。
  const onHint = () => {
    const store = useGame.getState()
    if (store.winner || store.turn !== store.myColor) return
    const mv = bestMove(store.board, store.myColor, 3)
    setHint({ x: mv.x, y: mv.y })
    playSfx('button')
  }

  // 预演：从当前局面起，AI 交替推演双方各 3 步（共 6 手），仅展示不落子。
  const onPreview = () => {
    const store = useGame.getState()
    if (store.winner) return
    let board = store.board
    let color: Color = store.turn
    const steps: Overlay[] = []
    for (let i = 0; i < 6; i++) {
      const mv = bestMove(board, color, 2)
      steps.push({ x: mv.x, y: mv.y, color: PREVIEW_COLORS[i], label: String(i + 1) })
      board = applyMove(board, { x: mv.x, y: mv.y, color })
      if (checkWin(board, mv.x, mv.y)) break // 若中途已连五则停止
      color = color === 'black' ? 'white' : 'black'
    }
    setPreviewSteps(steps)
    playSfx('button')
  }

  const endPreview = () => setPreviewSteps(null)

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
        // 服务端裁决：播放连线动画（若有）后展示结果弹窗，不再跳转结果页。
        finish(m.winner === myUid, m.reason)
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
        // 让 AI「思考」总时长落在 1~2s 随机区间（扣除真实运算耗时），避免落子过快。
        const wait = Math.max(0, 1000 + Math.random() * 1000 - (performance.now() - aiStartRef.current))
        window.setTimeout(() => {
          if (settledRef.current || useGame.getState().winner) return
          useGame.getState().place(e.data.x, e.data.y, 'white')
          playSfx('place')
          const w = useGame.getState().winner
          if (w) finish(w === useGame.getState().myColor) // AI 落子后若分出胜负立即结算
        }, wait)
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
      aiStartRef.current = performance.now()
      workerRef.current?.postMessage({ board: g.board, color: 'white', level: st.level })
    }
  }, [g.turn, g.winner, g.board, st.mode, st.level])

  // 胜负音效由 settleAi/服务端 game_over 负责，这里不再用响应式 effect（避免残留 winner 触发跳转）。

  // 人机模式：轮到我方时开启 60s 倒计时；AI 思考时不计时。
  useEffect(() => {
    if (st.mode !== 'ai' || !started) return
    if (!g.winner && g.turn === g.myColor) setDeadline(Date.now() + 30000)
    else setDeadline(null)
  }, [g.turn, g.winner, started, st.mode, g.myColor])

  // 回合倒计时：每 250ms 计算剩余秒；≤5s 滴答提示；归零处理超时
  // （人机模式判我方负；真人模式由服务端裁决，客户端仅展示）。
  useEffect(() => {
    if (deadline == null) return
    const t = setInterval(() => {
      const { remain: s } = countdownState(deadline, Date.now(), 30)
      setRemain(s)
      if (s <= 5 && s > 0) playSfx('tick')
      if (s <= 0) {
        clearInterval(t)
        setDeadline(null)
        if (st.mode === 'ai' && !useGame.getState().winner) {
          playSfx('timeout')
          finish(false, 'timeout') // 人机超时判负
        }
      }
    }, 250)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline])

  // 确认落子：本地落子 + 音效；真人模式同时上报服务端。落子后清除提示高亮。
  const onConfirm = () => {
    const p = g.pending
    if (!p || useGame.getState().winner) return
    g.confirm()
    setHint(null)
    playSfx('place')
    if (st.mode === 'pvp' && wsRef.current) {
      sendMove(wsRef.current, p.x, p.y)
      return // 真人对局由服务端 game_over 结算
    }
    // 人机：我方落子后若已连五立即结算取胜（连线动画结束后再弹窗）。
    const w = useGame.getState().winner
    if (w) finish(w === useGame.getState().myColor)
  }

  // 认输/退出：真人模式上报服务端认输（由服务端 game_over 驱动结算）；人机模式判我方负并结算。
  const onResign = () => {
    if (!window.confirm('确定认输并结束本局？')) return
    if (st.mode === 'pvp' && wsRef.current) {
      sendResign(wsRef.current)
      return
    }
    finish(false, 'resign')
  }

  // 好友对战等待超时（5 分钟）：关闭连接、弹窗提示后返回首页。
  useEffect(() => {
    if (started || st.mode !== 'pvp') return
    const dl = Date.now() + 300000
    const t = setInterval(() => {
      const left = Math.max(0, Math.round((dl - Date.now()) / 1000))
      setWaitLeft(left)
      if (left <= 0) {
        clearInterval(t)
        wsRef.current?.close()
        window.alert('等待好友超时，返回首页')
        nav('/')
      }
    }, 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, st.mode])

  if (!started) {
    const inviteUrl = st.roomId ? `${window.location.origin}/room/${st.roomId}` : ''
    const mm = Math.floor(waitLeft / 60)
    const ss = String(waitLeft % 60).padStart(2, '0')
    return (
      <div className="game screen">
        <h2 className="tip">等待对手加入…</h2>
        <p className="countdown warn">
          剩余等待 {mm}:{ss}
        </p>
        {st.roomId && (
          <div className="room-invite">
            <p>房间号：{st.roomId}</p>
            <p className="invite-link">{inviteUrl}</p>
            <button onClick={() => navigator.clipboard?.writeText(inviteUrl).catch(() => {})}>
              复制邀请链接
            </button>
          </div>
        )}
        <button onClick={() => nav('/')}>退出</button>
      </div>
    )
  }

  const overlays: Overlay[] | undefined = previewSteps
    ? previewSteps
    : hint
      ? [{ x: hint.x, y: hint.y, color: '#f1c40f', label: '★' }]
      : undefined

  return (
    <div className="game screen">
      <PlayerBar
        me={{ nickname: '我', avatar: 'avatar_01', rankLabel: rankLabel(1), color: g.myColor } as PlayerInfo}
        opp={{
          nickname: st.mode === 'ai' ? 'AI大师' : '对手',
          avatar: 'avatar_02',
          rankLabel: rankLabel(3),
          color: g.myColor === 'black' ? 'white' : 'black',
        } as PlayerInfo}
        turn={g.turn}
        timer={
          deadline != null
            ? {
                remain,
                progress: remain / 30,
                level: remain <= 5 ? 'danger' : remain <= 10 ? 'warn' : 'normal',
              }
            : null
        }
      />
      <BoardCanvas
        onConfirm={onConfirm}
        overlays={overlays}
        interactive={!previewSteps && introDone}
        onWinAnimationEnd={() => setShowModal(true)}
      />
      {started && !introDone && <StartCountdown onDone={() => setIntroDone(true)} />}
      <div className="hud">
        {g.turn === g.myColor ? <span className="tip">轮到你落子</span> : <span>对方思考中…</span>}
        <GameMenu
          onSettings={() => nav('/settings')}
          actions={[
            ...(st.mode === 'ai' && !previewSteps
              ? [{ label: '提示', onClick: onHint }, { label: '预演', onClick: onPreview }]
              : []),
            ...(previewSteps ? [{ label: '结束预演', onClick: endPreview }] : []),
            ...(st.mode === 'pvp' && wsRef.current && !previewSteps
              ? [{ label: '悔棋', onClick: () => sendUndoReq(wsRef.current!) }]
              : []),
            ...(!previewSteps ? [{ label: '认输', onClick: onResign }] : []),
          ]}
        />
      </div>
      {showModal && result && (
        <ResultOverlay
          win={result.win}
          coins={result.win ? 120 : 0}
          me={{ nickname: '我', avatar: 'avatar_01', rankLabel: rankLabel(1), points: 10, threshold: 30, delta: result.win ? 10 : -10 }}
          opp={{ nickname: st.mode === 'ai' ? 'AI大师' : '对手', avatar: 'avatar_02', rankLabel: rankLabel(3), points: 20, threshold: 30, delta: result.win ? -10 : 10 }}
          onRematch={rematch}
          onHome={() => nav('/')}
          onShare={() => alert('分享（后续接入）')}
          onDouble={() => alert('看广告双倍（阶段C）')}
        />
      )}
    </div>
  )
}
