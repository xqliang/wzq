import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { SIZE } from '../core/types'
import { useGame } from '../store/game'

const CELL = 40 // 相邻交叉点像素间距（逻辑坐标）
const PAD = 30 // 棋盘外边距（逻辑坐标）
const PX = CELL * (SIZE - 1) + PAD * 2 // 画布逻辑边长（绘制用，固定）

// 棋盘覆盖标记：提示/预演用。color 为 CSS 颜色，label 可选（如预演步序号）。
export interface Overlay {
  x: number
  y: number
  color: string
  label?: string
}

// 预加载古风玉石棋子贴图（模块级，只加载一次）。贴图未就绪则回退圆形绘制。
const pieceImgs: Record<'black' | 'white', HTMLImageElement> = {
  black: new Image(),
  white: new Image(),
}
pieceImgs.black.src = '/assets/img/piece_black.png'
pieceImgs.white.src = '/assets/img/piece_white.png'

// Canvas 棋盘：木色底 + 网格 + 棋子；预落子半透明；最近一手呼吸灯；覆盖标记。
// 自适应：绘制永远用固定逻辑坐标 PX（配合 dpr 保持清晰），显示尺寸按容器宽度缩放，
// 因此在手机上棋盘会整体缩小铺满而不被裁切。点击坐标按显示/逻辑比例换算。
// 预落子时在棋子旁浮出 ✓确认 / ✕取消 图标，便于就地确认。
export function BoardCanvas({
  onConfirm,
  overlays,
  interactive = true,
}: {
  onConfirm: () => void
  overlays?: Overlay[]
  interactive?: boolean
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const ref = useRef<HTMLCanvasElement>(null)
  const [disp, setDisp] = useState(PX) // 实际显示边长（正方形，css px）
  const board = useGame((s) => s.board)
  const pending = useGame((s) => s.pending)
  const last = useGame((s) => s.lastMove)
  const turn = useGame((s) => s.turn)
  const myColor = useGame((s) => s.myColor)
  const preview = useGame((s) => s.preview)
  const cancel = useGame((s) => s.cancel)

  // 按容器宽度决定显示尺寸（上限 PX，避免桌面端过大）。监听窗口变化。
  useEffect(() => {
    const measure = () => {
      const w = wrapRef.current?.clientWidth ?? PX
      setDisp(Math.max(200, Math.min(w, PX)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const cv = ref.current!
    const dpr = window.devicePixelRatio || 1
    cv.width = PX * dpr // 背景位图固定按逻辑尺寸×dpr，清晰
    cv.height = PX * dpr
    cv.style.width = `${disp}px` // 显示尺寸随容器缩放
    cv.style.height = `${disp}px`
    const ctx = cv.getContext('2d')!
    let raf = 0
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, PX, PX)
      ctx.fillStyle = '#e3c088'
      ctx.fillRect(0, 0, PX, PX)
      // 网格
      ctx.strokeStyle = '#6b4423'
      ctx.lineWidth = 1
      for (let i = 0; i < SIZE; i++) {
        ctx.beginPath()
        ctx.moveTo(PAD, PAD + i * CELL)
        ctx.lineTo(PX - PAD, PAD + i * CELL)
        ctx.moveTo(PAD + i * CELL, PAD)
        ctx.lineTo(PAD + i * CELL, PX - PAD)
        ctx.stroke()
      }
      // 星位（天元 + 四角）
      ctx.fillStyle = '#6b4423'
      for (const [sx, sy] of [
        [7, 7],
        [3, 3],
        [11, 3],
        [3, 11],
        [11, 11],
      ]) {
        ctx.beginPath()
        ctx.arc(PAD + sx * CELL, PAD + sy * CELL, 3.5, 0, Math.PI * 2)
        ctx.fill()
      }
      // 棋子
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) if (board[y][x]) drawStone(ctx, x, y, board[y][x]!, 1)
      // 预落子半透明
      if (pending) drawStone(ctx, pending.x, pending.y, myColor, 0.45)
      // 最新子呼吸灯
      if (last && board[last.y][last.x]) {
        const pulse = 0.5 + 0.5 * Math.sin(t / 300)
        ctx.beginPath()
        ctx.arc(PAD + last.x * CELL, PAD + last.y * CELL, CELL * 0.45 + pulse * 4, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(200,40,40,${0.4 + pulse * 0.4})`
        ctx.lineWidth = 2.5
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
  }, [board, pending, last, myColor, overlays, disp])

  const onClick = (e: ReactMouseEvent) => {
    if (!interactive) return
    if (turn !== myColor) return
    const rect = ref.current!.getBoundingClientRect()
    const scale = PX / rect.width // 显示 -> 逻辑
    const lx = (e.clientX - rect.left) * scale
    const ly = (e.clientY - rect.top) * scale
    const x = Math.round((lx - PAD) / CELL)
    const y = Math.round((ly - PAD) / CELL)
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
    if (pending && pending.x === x && pending.y === y) onConfirm()
    else preview(x, y)
  }

  // 预落子旁的 ✓/✕ 浮动按钮位置（显示坐标）。靠右列则按钮放左侧，避免出界。
  const scale = disp / PX
  const stone = pending
    ? { cx: (PAD + pending.x * CELL) * scale, cy: (PAD + pending.y * CELL) * scale }
    : null
  const r = CELL * 0.45 * scale
  const side = pending && pending.x >= 12 ? -1 : 1 // 靠右两列时按钮放左边

  return (
    <div ref={wrapRef} className="board-wrap">
      <canvas ref={ref} onClick={onClick} className="board-canvas" />
      {interactive && pending && stone && (
        <>
          <button
            className="board-btn confirm"
            style={{ left: stone.cx + side * (r + 20), top: stone.cy - r - 8 }}
            onClick={onConfirm}
            aria-label="确认落子"
          >
            ✓
          </button>
          <button
            className="board-btn cancel"
            style={{ left: stone.cx + side * (r + 20), top: stone.cy + r + 8 }}
            onClick={cancel}
            aria-label="取消"
          >
            ✕
          </button>
        </>
      )}
    </div>
  )
}

// 绘制单颗棋子；alpha 用于预落子半透明。贴图就绪用贴图，否则回退圆形。
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
    const size = CELL * 0.9
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  } else {
    ctx.beginPath()
    ctx.arc(cx, cy, CELL * 0.42, 0, Math.PI * 2)
    ctx.fillStyle = color === 'black' ? '#1a1a1a' : '#f5f5f0'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.stroke()
  }
  ctx.restore()
}
