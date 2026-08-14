import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { SIZE } from '../core/types'
import { useGame } from '../store/game'
import { getSettings } from '../audio/audio'
import type { Effect } from '../audio/audio'
import { getTheme } from './themes'
import type { StoneSpec, Theme } from './themes'

const CELL = 40 // 相邻交叉点像素间距（逻辑坐标）
const PAD = 30 // 网格到棋盘面边缘的内边距（逻辑坐标）
const PX = CELL * (SIZE - 1) + PAD * 2 // 画布逻辑边长（绘制用，固定）
const FRAME = 14 // 立体外框厚度（逻辑坐标），营造“厚度/边框”
const PI2 = Math.PI * 2

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

// 两色贴图的透明留白不同，用不同放大系数抵消，使黑白子视觉大小一致。
const STONE_FACTOR: Record<'black' | 'white', number> = { black: 2.0, white: 1.5 }

// 灰尘粒子：从落点向外飞散并渐隐（简单物理：位置=速度*时间）。
interface Dust {
  a: number // 飞散角度
  sp: number // 速度系数
  r0: number // 初始半径
}

// Canvas 棋盘：立体木框 + 网格 + 棋子；预落子四角准心；最近一手落下动画/呼吸灯；
// 落子特效（水波纹/灰尘）；主题化配色与棋子渲染。
// 自适应：绘制永远用固定逻辑坐标 PX（配合 dpr 保持清晰），显示尺寸按容器宽度缩放。
// 交互：点空点=预落子（移动准心）；再点同一准心点=确认落子（唯一落子方式，无确认按钮）。
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
    const dropStart = performance.now() // 本次 last 变化即视为一次落子，做“落下”动画
    // 落子特效在“落子那一刻”捕获，避免中途切设置影响本次动画。
    const effect: Effect = getSettings().effect
    const dust: Dust[] =
      effect === 'dust'
        ? Array.from({ length: 8 }, () => ({
            a: Math.random() * PI2,
            sp: 0.6 + Math.random() * 1.4,
            r0: 2 + Math.random() * 2.5,
          }))
        : []

    let raf = 0
    const draw = (t: number) => {
      const theme = getTheme(getSettings().theme) // 每帧读取，支持实时切换主题
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, PX, PX)
      drawFrame(ctx, theme) // 立体外框 + 棋盘面
      // 网格
      ctx.strokeStyle = theme.line
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
      ctx.fillStyle = theme.star
      for (const [sx, sy] of [
        [7, 7],
        [3, 3],
        [11, 3],
        [3, 11],
        [11, 11],
      ]) {
        ctx.beginPath()
        ctx.arc(PAD + sx * CELL, PAD + sy * CELL, 3.5, 0, PI2)
        ctx.fill()
      }
      // 棋子（最近一手最后画，带“落下”动画）
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          if (!board[y][x]) continue
          if (last && x === last.x && y === last.y) continue
          drawStone(ctx, x, y, board[y][x]!, 1, 1, theme)
        }
      // 预落子：淡色棋子 + 四角准心（相机对焦框）。
      if (pending) {
        drawStone(ctx, pending.x, pending.y, myColor, 0.35, 1, theme)
        drawCrosshair(ctx, pending.x, pending.y, theme.accent, t)
      }
      // 最新子：落下动画（起始略大→收拢，有分量）+ 触地冲击环 / 稳定后呼吸灯
      if (last && board[last.y][last.x]) {
        const elapsed = t - dropStart
        const cx = PAD + last.x * CELL
        const cy = PAD + last.y * CELL
        const k = Math.max(0, 1 - elapsed / 200)
        drawStone(ctx, last.x, last.y, board[last.y][last.x]!, 1, 1 + 0.45 * k * k, theme)
        if (elapsed < 260) {
          const p = elapsed / 260
          ctx.beginPath()
          ctx.arc(cx, cy, CELL * (0.5 + p * 0.5), 0, PI2)
          ctx.strokeStyle = `rgba(80,50,20,${0.5 * (1 - p)})`
          ctx.lineWidth = 3 * (1 - p)
          ctx.stroke()
        } else {
          const pulse = 0.5 + 0.5 * Math.sin(t / 300)
          ctx.beginPath()
          ctx.arc(cx, cy, CELL * 0.5 + pulse * 4, 0, PI2)
          ctx.strokeStyle = `rgba(200,40,40,${0.35 + pulse * 0.35})`
          ctx.lineWidth = 2.5
          ctx.stroke()
        }
        // 落子特效（叠加在落下动画之上）：水波纹 / 灰尘 / 无。
        drawEffect(ctx, effect, dust, cx, cy, elapsed, theme.accent)
      }
      // 覆盖标记（提示光圈 / 预演步序）
      if (overlays) {
        for (const o of overlays) {
          const cx = PAD + o.x * CELL
          const cy = PAD + o.y * CELL
          ctx.beginPath()
          ctx.arc(cx, cy, CELL * 0.4, 0, PI2)
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
    // 点击已选中的准心点=确认落子（唯一落子方式）；否则移动准心到该点。
    if (pending && pending.x === x && pending.y === y) onConfirm()
    else preview(x, y)
  }

  return (
    <div ref={wrapRef} className="board-wrap">
      <canvas ref={ref} onClick={onClick} className="board-canvas" />
    </div>
  )
}

// 立体外框：外深内浅的斜面（top/left 受光、right/bottom 背光）+ 内凹棋盘面。
function drawFrame(ctx: CanvasRenderingContext2D, theme: Theme) {
  const F = FRAME
  // 最外层一圈最深，托出厚度。
  ctx.fillStyle = theme.frameDark
  ctx.fillRect(0, 0, PX, PX)
  ctx.fillStyle = theme.frameBase
  ctx.fillRect(1.5, 1.5, PX - 3, PX - 3)
  // 四条斜面：上/左高光，右/下暗部，形成凸起的立体边框。
  const inner = { l: F, t: F, r: PX - F, b: PX - F }
  ctx.fillStyle = theme.frameLight
  ctx.beginPath() // 上斜面
  ctx.moveTo(0, 0)
  ctx.lineTo(PX, 0)
  ctx.lineTo(inner.r, inner.t)
  ctx.lineTo(inner.l, inner.t)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath() // 左斜面
  ctx.moveTo(0, 0)
  ctx.lineTo(inner.l, inner.t)
  ctx.lineTo(inner.l, inner.b)
  ctx.lineTo(0, PX)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = theme.frameDark
  ctx.beginPath() // 右斜面
  ctx.moveTo(PX, 0)
  ctx.lineTo(PX, PX)
  ctx.lineTo(inner.r, inner.b)
  ctx.lineTo(inner.r, inner.t)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath() // 下斜面
  ctx.moveTo(0, PX)
  ctx.lineTo(PX, PX)
  ctx.lineTo(inner.r, inner.b)
  ctx.lineTo(inner.l, inner.b)
  ctx.closePath()
  ctx.fill()
  // 棋盘面（内凹）。
  ctx.fillStyle = theme.boardFace
  ctx.fillRect(inner.l, inner.t, inner.r - inner.l, inner.b - inner.t)
  // 内凹阴影：面的上/左压暗、右/下提亮，让棋盘像“沉”在框里。
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.moveTo(inner.l, inner.b)
  ctx.lineTo(inner.l, inner.t)
  ctx.lineTo(inner.r, inner.t)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.beginPath()
  ctx.moveTo(inner.r, inner.t)
  ctx.lineTo(inner.r, inner.b)
  ctx.lineTo(inner.l, inner.b)
  ctx.stroke()
}

// 四角准心：围绕交叉点的四个 L 形转角括号（相机对焦框风格），带轻微呼吸。
function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  accent: string,
  t: number,
) {
  const cx = PAD + x * CELL
  const cy = PAD + y * CELL
  const b = CELL * (0.48 + 0.04 * Math.sin(t / 300)) // 括号半边长（呼吸）
  const len = CELL * 0.22 // 每条转角短线长度
  ctx.save()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const px = cx + dx * b
    const py = cy + dy * b
    ctx.beginPath()
    ctx.moveTo(px - dx * len, py) // 水平段（朝内）
    ctx.lineTo(px, py)
    ctx.lineTo(px, py - dy * len) // 垂直段（朝内）
    ctx.stroke()
  }
  ctx.restore()
}

// 落子特效：ripple=扩散水波纹环；dust=向外飞散的灰尘粒子；none=无。约 550ms。
function drawEffect(
  ctx: CanvasRenderingContext2D,
  effect: Effect,
  dust: Dust[],
  cx: number,
  cy: number,
  elapsed: number,
  accent: string,
) {
  const DUR = 550
  if (effect === 'ripple') {
    ctx.save()
    ctx.strokeStyle = accent
    for (let i = 0; i < 3; i++) {
      const e = elapsed - i * 120 // 每环延迟出现
      if (e < 0 || e > DUR) continue
      const p = e / DUR
      ctx.globalAlpha = (1 - p) * 0.55
      ctx.lineWidth = 2 * (1 - p) + 0.5
      ctx.beginPath()
      ctx.arc(cx, cy, CELL * (0.3 + p * 0.95), 0, PI2)
      ctx.stroke()
    }
    ctx.restore()
  } else if (effect === 'dust') {
    if (elapsed > DUR) return
    const p = elapsed / DUR
    ctx.save()
    ctx.fillStyle = accent
    for (const d of dust) {
      const dist = d.sp * elapsed * 0.11 // 位置 = 速度 * 时间
      const px = cx + Math.cos(d.a) * dist
      const py = cy + Math.sin(d.a) * dist + 0.00035 * elapsed * elapsed * 0.5 // 轻微下坠
      ctx.globalAlpha = (1 - p) * 0.7
      ctx.beginPath()
      ctx.arc(px, py, d.r0 * (1 - p * 0.5), 0, PI2)
      ctx.fill()
    }
    ctx.restore()
  }
  // 'none'：不额外绘制。
}

// 程序化棋子：径向渐变（高光→主体→外缘）+ 可选描边/高光点。
function drawProgStone(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  spec: StoneSpec,
) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r)
  g.addColorStop(0, spec.hi)
  g.addColorStop(0.55, spec.body)
  g.addColorStop(1, spec.edge)
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, PI2)
  ctx.fillStyle = g
  ctx.fill()
  if (spec.rim) {
    ctx.strokeStyle = spec.rim
    ctx.lineWidth = 1.2
    ctx.stroke()
  }
  if (spec.specular) {
    // 玻璃光泽：左上偏一点的椭圆高光。
    ctx.save()
    ctx.beginPath()
    ctx.ellipse(cx - r * 0.3, cy - r * 0.32, r * 0.3, r * 0.18, -0.6, 0, PI2)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fill()
    ctx.restore()
  }
}

// 绘制单颗棋子；alpha 用于预落子半透明；scale 用于落下动画（以交叉点为中心缩放）。
// wood 主题用玉石贴图（就绪时）；其余主题一律用程序化径向渐变圆子。
function drawStone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: 'black' | 'white',
  alpha: number,
  scale: number,
  theme: Theme,
) {
  ctx.save()
  ctx.globalAlpha = alpha
  const cx = PAD + x * CELL
  const cy = PAD + y * CELL
  const img = pieceImgs[color]
  if (theme.useImage && img.complete && img.naturalWidth > 0) {
    const size = CELL * STONE_FACTOR[color] * scale
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  } else {
    drawProgStone(ctx, cx, cy, CELL * 0.46 * scale, color === 'black' ? theme.black : theme.white)
  }
  ctx.restore()
}
