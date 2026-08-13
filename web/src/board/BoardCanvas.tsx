import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { SIZE } from '../core/types'
import { useGame } from '../store/game'

const CELL = 40 // 相邻交叉点像素间距
const PAD = 30 // 棋盘外边距
const PX = CELL * (SIZE - 1) + PAD * 2 // 画布逻辑边长

// Canvas 棋盘：绘制木色底 + 网格 + 棋子；预落子半透明；最近一手呼吸灯动画。
// 点击就近取交叉点：若点在已预落子处则确认，否则设为新的预落子。
export function BoardCanvas({ onConfirm }: { onConfirm: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const board = useGame((s) => s.board)
  const pending = useGame((s) => s.pending)
  const last = useGame((s) => s.lastMove)
  const turn = useGame((s) => s.turn)
  const myColor = useGame((s) => s.myColor)
  const preview = useGame((s) => s.preview)

  useEffect(() => {
    const cv = ref.current!
    const dpr = window.devicePixelRatio || 1
    cv.width = PX * dpr
    cv.height = PX * dpr
    cv.style.width = `${PX}px`
    cv.style.height = `${PX}px`
    const ctx = cv.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, PX, PX)
      // 木色底
      ctx.fillStyle = '#d9b586'
      ctx.fillRect(0, 0, PX, PX)
      // 网格
      ctx.strokeStyle = '#5a3a1a'
      ctx.lineWidth = 1
      for (let i = 0; i < SIZE; i++) {
        ctx.beginPath()
        ctx.moveTo(PAD, PAD + i * CELL)
        ctx.lineTo(PX - PAD, PAD + i * CELL)
        ctx.moveTo(PAD + i * CELL, PAD)
        ctx.lineTo(PAD + i * CELL, PX - PAD)
        ctx.stroke()
      }
      // 棋子
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++)
          if (board[y][x]) drawStone(ctx, x, y, board[y][x]!, 1)
      // 预落子半透明
      if (pending) drawStone(ctx, pending.x, pending.y, myColor, 0.5)
      // 最新子呼吸灯
      if (last && board[last.y][last.x]) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 300)
        ctx.beginPath()
        ctx.arc(PAD + last.x * CELL, PAD + last.y * CELL, CELL * 0.45 + pulse * 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(220,60,60,${0.4 + pulse * 0.4})`
        ctx.lineWidth = 2
        ctx.stroke()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [board, pending, last, myColor])

  const onClick = (e: ReactMouseEvent) => {
    if (turn !== myColor) return
    const rect = ref.current!.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left - PAD) / CELL)
    const y = Math.round((e.clientY - rect.top - PAD) / CELL)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    if (pending && pending.x === x && pending.y === y) onConfirm()
    else preview(x, y)
  }

  return <canvas ref={ref} onClick={onClick} style={{ borderRadius: 8, cursor: 'pointer' }} />
}

// 绘制单颗棋子；alpha 用于预落子半透明。
function drawStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: 'black' | 'white',
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.arc(PAD + x * CELL, PAD + y * CELL, CELL * 0.42, 0, Math.PI * 2)
  ctx.fillStyle = color === 'black' ? '#1a1a1a' : '#f5f5f0'
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.stroke()
  ctx.restore()
}
