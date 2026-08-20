import { useEffect, useRef, useState } from 'react'
import { img } from '../lib/asset'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { SIZE } from '../core/types'
import { useGame } from '../store/game'
import { getSettings } from '../audio/audio'
import type { Effect } from '../audio/audio'
import { getTheme } from './themes'
import type { StoneSpec, Theme } from './themes'
import { drawEffect, makeDust } from './effects'
import type { Dust } from './effects'

const CELL = 40 // 相邻交叉点像素间距（逻辑坐标）
const PAD = 30 // 网格到棋盘面边缘的内边距（逻辑坐标）
const PX = CELL * (SIZE - 1) + PAD * 2 // 画布逻辑边长（绘制用，固定）
const LIP = 14 // 底部立体厚度（额外画在正方形盘面之下，不占用盘面，保证四边留白等宽）
const PXH = PX + LIP // 画布逻辑高度 = 正方形盘面 + 底部厚度
const PI2 = Math.PI * 2
// 胜利连线动画节拍：逐子点亮步进、齐闪时长。
const WIN_STEP = 240 // 每颗棋子依次点亮的间隔（ms）
const WIN_FLASH = 1000 // 齐闪阶段总时长（ms）
const WIN_GOLD = '#ffd24a'

// 棋盘覆盖标记：提示/预演用。color 为 CSS 颜色，label 可选（如预演步序号）。
// labelColor 可指定数字颜色（默认与 color 同色）；渲染时数字带深色描边保证可读。
export interface Overlay {
  x: number
  y: number
  color: string
  label?: string
  labelColor?: string
}

// 预加载古风玉石棋子贴图（模块级，只加载一次）。贴图未就绪则回退圆形绘制。
const pieceImgs: Record<'black' | 'white', HTMLImageElement> = {
  black: new Image(),
  white: new Image(),
}
pieceImgs.black.src = img('piece_black')
pieceImgs.white.src = img('piece_white')

// 棋盘面木纹贴图缓存（按主题 faceImage 名字懒加载，经 img() 解析为打包后 URL）。未就绪则回退纯色盘面。
const faceImgs: Record<string, HTMLImageElement> = {}
function faceImage(name?: string): HTMLImageElement | null {
  if (!name) return null
  let el = faceImgs[name]
  if (!el) {
    el = new Image()
    el.src = img(name)
    faceImgs[name] = el
  }
  return el.complete && el.naturalWidth > 0 ? el : null
}

// 两色贴图的透明留白不同，用不同放大系数抵消，使黑白子视觉大小一致。
const STONE_FACTOR: Record<'black' | 'white', number> = { black: 2.0, white: 1.5 }

// 灰尘/迸屑粒子类型见 ./effects（drawEffect 与其生成器 makeDust 已抽到共享模块）。

// Canvas 棋盘：立体木框 + 网格 + 棋子；预落子四角准心；最近一手落下动画/呼吸灯；
// 落子特效（水波纹/灰尘）；主题化配色与棋子渲染。
// 自适应：绘制永远用固定逻辑坐标 PX（配合 dpr 保持清晰），显示尺寸按容器宽度缩放。
// 交互：点空点=预落子（移动准心）；再点同一准心点=确认落子（唯一落子方式，无确认按钮）。
export function BoardCanvas({
  onConfirm,
  overlays,
  interactive = true,
  onWinAnimationEnd,
}: {
  onConfirm: () => void
  overlays?: Overlay[]
  interactive?: boolean
  onWinAnimationEnd?: () => void
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
  const winLine = useGame((s) => s.winLine)
  const undoMark = useGame((s) => s.undoMark)
  const oppEffect = useGame((s) => s.oppEffect)
  // 保证胜利动画结束回调只触发一次。
  const firedRef = useRef(false)
  // 用 ref 持有最新回调，避免其变化导致绘制 effect 重启（打断动画计时）。
  const onWinEndRef = useRef(onWinAnimationEnd)
  onWinEndRef.current = onWinAnimationEnd

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

  // 落下动画/落子特效只在「最新一手真正变化」时重启：预落子、覆盖层、悔棋标记等变化
  // 会让绘制 effect 重新运行，但不应让上一颗已落的子重播落下动效。用 ref 记住上一手。
  const dropStartRef = useRef(0)
  const lastKeyRef = useRef('')
  const dustRef = useRef<Dust[]>([])

  useEffect(() => {
    const cv = ref.current!
    const dpr = window.devicePixelRatio || 1
    cv.width = PX * dpr // 背景位图固定按逻辑尺寸×dpr，清晰
    cv.height = PXH * dpr // 高度含底部立体厚度
    cv.style.width = `${disp}px` // 显示尺寸随容器缩放
    cv.style.height = `${(disp * PXH) / PX}px`
    const ctx = cv.getContext('2d')!
    // 仅当最新一手坐标变化时，重置落下动画起点并重新生成粒子（避免上一子重播）。
    const lastKey = last ? `${last.x},${last.y}` : ''
    // 落子特效：我方/AI 用本地设置；PvP 对手的落子用对手下发的特效（oppEffect）。
    const lastColor = last ? board[last.y]?.[last.x] : null
    const effect: Effect = lastColor && lastColor !== myColor && oppEffect ? (oppEffect as Effect) : getSettings().effect
    if (lastKey && lastKey !== lastKeyRef.current) {
      dropStartRef.current = performance.now()
      dustRef.current = effect === 'dust' ? makeDust() : []
    }
    lastKeyRef.current = lastKey
    // 胜利连线动画起点：winLine 存在即开始计时；无连线时复位一次触发标记。
    const winStart = winLine ? performance.now() : 0
    if (!winLine) firedRef.current = false

    let raf = 0
    const draw = (t: number) => {
      const theme = getTheme(getSettings().theme) // 每帧读取，支持实时切换主题
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, PX, PXH)
      drawFrame(ctx, theme) // 正方形盘面 + 底部立体厚度
      // 网格
      ctx.strokeStyle = theme.line
      ctx.lineWidth = 1.5
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
        ctx.arc(PAD + sx * CELL, PAD + sy * CELL, 4.5, 0, PI2)
        ctx.fill()
      }
      // 棋子（最近一手最后画，带“落下”动画）
      for (let y = 0; y < SIZE; y++)
        for (let x = 0; x < SIZE; x++) {
          if (!board[y][x]) continue
          if (last && x === last.x && y === last.y) continue
          drawStone(ctx, x, y, board[y][x]!, 1, 1, theme)
        }
      // 预落子：只显示四角准心（相机对焦框），不再画半透明棋子。
      if (pending) {
        drawCrosshair(ctx, pending.x, pending.y, theme.accent, t)
      }
      // 悔棋位置标记：小圆圈 + 中心小黄点（下一手落子后由 store 清除）。
      if (undoMark) {
        drawUndoMark(ctx, PAD + undoMark.x * CELL, PAD + undoMark.y * CELL)
      }
      // 最新子：落下动画（起始略大→收拢，有分量）+ 触地冲击环；落定后用静态标记（不再呼吸闪烁）。
      if (last && board[last.y][last.x]) {
        const elapsed = t - dropStartRef.current
        const cx = PAD + last.x * CELL
        const cy = PAD + last.y * CELL
        const k = Math.max(0, 1 - elapsed / 200)
        // 落子水波纹（画在棋子下面）：桌面上从落点向外逐圈扩大的同心圆环，细描边、渐隐，像石子入水。
        drawEffect(ctx, effect, dustRef.current, cx, cy, elapsed, theme.accent)
        drawStone(ctx, last.x, last.y, board[last.y][last.x]!, 1, 1 + 0.45 * k * k, theme)
        // 最近一手静态标记：白子=描边黄点，黑子=靶心，清晰不刺眼（参考竞品）。
        drawLastMark(ctx, cx, cy, board[last.y][last.x]!)
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
            ctx.font = `bold ${CELL * 0.5}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            // 深色描边 + 指定颜色填充，确保序号在任意棋盘底色上都清晰。
            ctx.lineWidth = Math.max(2, Math.round(CELL * 0.12))
            ctx.strokeStyle = 'rgba(50,30,5,0.8)'
            ctx.strokeText(o.label, cx, cy)
            ctx.fillStyle = o.labelColor ?? o.color
            ctx.fillText(o.label, cx, cy)
          }
        }
      }
      // 胜利连线：逐子高亮 -> 齐闪 -> 结束回调。画在棋子之上。
      if (winLine && winLine.length) {
        drawWinLine(ctx, winLine, t - winStart)
        if (t - winStart >= winLine.length * WIN_STEP + WIN_FLASH && !firedRef.current) {
          firedRef.current = true
          onWinEndRef.current?.()
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [board, pending, last, myColor, overlays, disp, winLine, undoMark, oppEffect])

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

// 圆角矩形路径（四角半径可分别指定），用于把「盘面 + 底部厚度」整体裁剪成自然圆角。
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  tl: number,
  tr: number,
  br: number,
  bl: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + tl, y)
  ctx.lineTo(x + w - tr, y)
  ctx.arcTo(x + w, y, x + w, y + tr, tr)
  ctx.lineTo(x + w, y + h - br)
  ctx.arcTo(x + w, y + h, x + w - br, y + h, br)
  ctx.lineTo(x + bl, y + h)
  ctx.arcTo(x, y + h, x, y + h - bl, bl)
  ctx.lineTo(x, y + tl)
  ctx.arcTo(x, y, x + tl, y, tl)
  ctx.closePath()
}

// 立体外框：整块「盘面 + 底部厚度」裁成同半径圆角木盘，底部深木厚度自然沿圆角包裹，
// 前下缘转角平滑（弧线衔接）。深色底座颜色取自主题(baseShadow/frameDark)，故各皮肤 3D 面随之变化。
// 配合 .board-wrap 的落地阴影，像厚木盘坐在桌面上。
const FRAME_R = 14 // 圆角半径（顶/底一致，避免底部弧线切入盘面）
function drawFrame(ctx: CanvasRenderingContext2D, theme: Theme) {
  // 1) 深色立体底座（含底部厚度 LIP）：整块裁圆角，铺深木竖向渐变（上浅下深）。
  ctx.save()
  roundRectPath(ctx, 0, 0, PX, PXH, FRAME_R, FRAME_R, FRAME_R, FRAME_R)
  ctx.clip()
  const dark = ctx.createLinearGradient(0, PX, 0, PXH)
  dark.addColorStop(0, theme.baseShadow ?? theme.frameDark)
  dark.addColorStop(1, theme.frameDark)
  ctx.fillStyle = dark
  ctx.fillRect(0, 0, PX, PXH)
  ctx.restore()
  // 2) 盘面：上方正方形，裁成同半径圆角（底角亦圆，与底座同半径 => 前下缘等宽包裹）。
  ctx.save()
  roundRectPath(ctx, 0, 0, PX, PX, FRAME_R, FRAME_R, FRAME_R, FRAME_R)
  ctx.clip()
  ctx.fillStyle = theme.boardFace
  ctx.fillRect(0, 0, PX, PX)
  const face = faceImage(theme.faceImage)
  if (face) ctx.drawImage(face, 0, 0, PX, PX)
  else drawBoardPattern(ctx, theme) // 非贴图皮肤：绘制古风花纹提升质感
  ctx.restore()
  // 3) 盘面/厚度交界高光缝：只画中段、避开两侧圆角转角，接缝自然不突兀。
  ctx.strokeStyle = theme.frameLight
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(FRAME_R, PX + 0.5)
  ctx.lineTo(PX - FRAME_R, PX + 0.5)
  ctx.stroke()
}

// 非木纹皮肤（纯色盘面）的古风花纹装饰：内细描边 + 四角祥云卷。
// 花纹画在盘面留白区（网格 PAD=30 之内的边距），不与棋子/网格重叠；颜色取自主题(star/line)，随皮肤变化。
function drawBoardPattern(ctx: CanvasRenderingContext2D, theme: Theme) {
  ctx.save()
  // 内描边（细，低透明度）。
  ctx.strokeStyle = theme.line
  ctx.globalAlpha = 0.3
  ctx.lineWidth = 1.5
  roundRectPath(ctx, 13, 13, PX - 26, PX - 26, 10, 10, 10, 10)
  ctx.stroke()
  // 四角祥云卷曲（镜像到四个角）。
  ctx.globalAlpha = 0.5
  ctx.strokeStyle = theme.star
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const cx = sx > 0 ? 23 : PX - 23
    const cy = sy > 0 ? 23 : PX - 23
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(sx, sy)
    ctx.beginPath()
    ctx.arc(0, 0, 13, PI2 * 0.03, PI2 * 0.24) // 外弧
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(7, 7, 5, PI2 * 0.5, PI2 * 1.05) // 内卷
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
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

// 悔棋位置标记：一个小圆圈 + 中心小黄点（下一手落子后清除）。参考竞品。
function drawUndoMark(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(90,60,15,0.9)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, CELL * 0.34, 0, PI2)
  ctx.stroke()
  ctx.fillStyle = '#ffcf2e'
  ctx.beginPath()
  ctx.arc(cx, cy, 4, 0, PI2)
  ctx.fill()
  ctx.lineWidth = 1.2
  ctx.stroke()
  ctx.restore()
}

// 最近一手静态标记：白子=描深边的黄色圆点；黑子=靶心（四向短刻线 + 中心点）。清晰而不刺眼。
function drawLastMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: 'black' | 'white') {
  ctx.save()
  if (color === 'white') {
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, PI2)
    ctx.fillStyle = '#ffcf2e'
    ctx.fill()
    ctx.lineWidth = 1.6
    ctx.strokeStyle = 'rgba(90,60,15,0.95)'
    ctx.stroke()
  } else {
    const R = 8
    ctx.strokeStyle = '#ffd24a'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      ctx.beginPath()
      ctx.moveTo(cx + dx * R * 0.5, cy + dy * R * 0.5)
      ctx.lineTo(cx + dx * R, cy + dy * R)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(cx, cy, 2.4, 0, PI2)
    ctx.fillStyle = '#ffd24a'
    ctx.fill()
  }
  ctx.restore()
}

// 落子特效绘制（drawEffect 及其辅助 drawStar5/drawHeart）已抽到 ./effects 共享模块，
// 供棋盘与商店预览共用，避免重复实现。

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
}

// 绘制单颗棋子；alpha 用于预落子半透明；scale 用于落下动画（以交叉点为中心缩放）。
// 所有主题统一叠加「接触阴影 + 左上玻璃高光」，增强棋子的立体感与光泽。
// 棋子统一用程序化径向渐变绘制（黑白玻璃子）；useImage 主题就绪时改用贴图。
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
  const r = CELL * 0.46 * scale // 视觉半径（阴影/高光定位）

  // 1) 接触阴影：棋子下方偏移的柔和暗影，营造“坐在棋盘上”的立体感。
  const sh = ctx.createRadialGradient(cx, cy + r * 0.5, r * 0.2, cx, cy + r * 0.5, r * 1.25)
  sh.addColorStop(0, 'rgba(0,0,0,0.30)')
  sh.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = sh
  ctx.beginPath()
  ctx.ellipse(cx, cy + r * 0.5, r * 1.08, r * 0.55, 0, 0, PI2)
  ctx.fill()

  // 2) 棋子本体。
  const img = pieceImgs[color]
  if (theme.useImage && img.complete && img.naturalWidth > 0) {
    const size = CELL * STONE_FACTOR[color] * scale
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  } else {
    drawProgStone(ctx, cx, cy, r, color === 'black' ? theme.black : theme.white)
  }

  // 3) 统一玻璃高光：左上一处亮斑（黑子更明显、白子稍弱），限制在棋子圆内。
  const hiA = color === 'black' ? 0.5 : 0.4
  const hx = cx - r * 0.32
  const hy = cy - r * 0.38
  const gh = ctx.createRadialGradient(hx, hy, 0, hx, hy, r * 0.72)
  gh.addColorStop(0, `rgba(255,255,255,${hiA})`)
  gh.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gh
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, PI2)
  ctx.fill()

  // specular 主题（玉石/流金）追加一处细锐高光点，增强光泽。
  if ((color === 'black' ? theme.black : theme.white).specular) {
    const sx = cx - r * 0.42
    const sy = cy - r * 0.46
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.3)
    sg.addColorStop(0, 'rgba(255,255,255,0.9)')
    sg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, PI2)
    ctx.fill()
  }
  ctx.restore()
}

// 胜利连线高亮：e 为距动画起点的毫秒数。
// 阶段一（顺序点亮）：从连线一端到另一端，逐子亮起金色光环，当前激活子带扩张脉冲。
// 阶段二（齐闪）：全部棋子随 sin 同步闪烁（约 3 次）。
function drawWinLine(
  ctx: CanvasRenderingContext2D,
  line: { x: number; y: number }[],
  e: number,
) {
  const n = line.length
  const SEQ = n * WIN_STEP // 顺序点亮阶段总时长
  ctx.save()
  ctx.lineCap = 'round'
  if (e < SEQ) {
    // 顺序点亮：已到时的棋子常亮，最新激活的一颗额外画扩张脉冲环。
    for (let i = 0; i < n; i++) {
      const on = e - i * WIN_STEP
      if (on < 0) continue
      const cx = PAD + line[i].x * CELL
      const cy = PAD + line[i].y * CELL
      drawGlowRing(ctx, cx, cy, CELL * 0.46, 1)
      // 当前激活子（进入 WIN_STEP 内）追加一圈扩张脉冲。
      if (on < WIN_STEP) {
        const p = on / WIN_STEP
        ctx.globalAlpha = 1 - p
        ctx.strokeStyle = WIN_GOLD
        ctx.lineWidth = 2 * (1 - p) + 0.5
        ctx.beginPath()
        ctx.arc(cx, cy, CELL * (0.46 + p * 0.45), 0, PI2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }
  } else {
    // 齐闪：3 次脉冲覆盖 WIN_FLASH。
    const fp = Math.min(1, (e - SEQ) / WIN_FLASH)
    const pulse = 0.5 + 0.5 * Math.sin(fp * Math.PI * 6)
    for (const c of line) {
      const cx = PAD + c.x * CELL
      const cy = PAD + c.y * CELL
      drawGlowRing(ctx, cx, cy, CELL * 0.46, 0.6 + pulse * 0.4)
    }
  }
  ctx.restore()
}

// 单颗棋子上的金色光环（亮环 + 柔和外晕）。alpha 控制整体强度。
function drawGlowRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  alpha: number,
) {
  ctx.save()
  // 外晕：宽而淡（收窄，避免过分凸出）。
  ctx.globalAlpha = alpha * 0.32
  ctx.strokeStyle = WIN_GOLD
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, PI2)
  ctx.stroke()
  // 亮环：细而明。
  ctx.globalAlpha = alpha
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, PI2)
  ctx.stroke()
  ctx.restore()
}
