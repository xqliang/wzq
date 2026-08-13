import { useEffect, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { SIZE } from '../core/types'
import { useGame } from '../store/game'

const CELL = 40 // 相邻交叉点像素间距
const PAD = 30 // 棋盘外边距
const PX = CELL * (SIZE - 1) + PAD * 2 // 画布逻辑边长

// 预加载古风玉石棋子贴图（模块级，只加载一次）。若贴图未就绪则回退到圆形绘制，
// 保证素材缺失/加载中时棋盘仍可正常渲染。
const pieceImgs: Record<'black' | 'white', HTMLImageElement> = {
  black: new Image(),
  white: new Image(),
}
pieceImgs.black.src = '/assets/img/piece_black.png'
pieceImgs.white.src = '/assets/img/piece_white.png'

// 棋盘覆盖标记：提示/预演用。color 为 CSS 颜色，label 可选（如预演步序号）。
export interface Overlay {
  x: number
  y: number
  color: string
  label?: string
}

// Canvas 棋盘：绘制木色底 + 网格 + 棋子；预落子半透明；最近一手呼吸灯动画。
// 点击就近取交叉点：若点在已预落子处则确认，否则设为新的预落子。
// overlays：额外标记（AI 提示 / 三步预演）。interactive=false 时禁用点击（预演中）。
export function BoardCanvas({
  onConfirm,
  overlays,
  interactive = true,
}: {
  onConfirm: () => void
  overlays?: Overlay[]
  interactive?: boolean
}) {
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
      // 覆盖标记（提示光圈 / 预演步序）
      if (overlays) {
        for (const o of overlays) {
          const cx = PAD + o.x * CELL
          const cy = PAD + o.y * CELL
          ctx.beginPath()
          ctx.arc(cx, cy, CELL * 0.4, 0, Math.PI * 2)
          ctx.strokeStyle = o.color
          ctx.lineWidth = 3
          ctx.stroke()
          if (o.label) {
            ctx.fillStyle = o.color
            ctx.font = `bold ${CELL * 0.5}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(o.label, cx, cy)
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [board, pending, last, myColor, overlays])

  const onClick = (e: ReactMouseEvent) => {
    if (!interactive) return
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
// 若对应贴图已加载完成则用贴图（居中、约 CELL*0.9 见方），否则回退到圆形绘制。
function drawStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: 'black' | 'white',
  alpha: number,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  const cx = PAD + x * CELL
  const cy = PAD + y * CELL
  const img = pieceImgs[color]
  if (img.complete && img.naturalWidth > 0) {
    // 贴图就绪：居中绘制约 CELL*0.9 见方，保留传入的 alpha（预落子预览半透明）。
    const size = CELL * 0.9
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  } else {
    // 回退：原圆形绘制。
    ctx.beginPath()
    ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2)
    ctx.fillStyle = color === 'black' ? '#1a1a1a' : '#f5f5f0'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.stroke()
  }
  ctx.restore()
}
