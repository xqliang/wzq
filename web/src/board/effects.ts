// 落子特效绘制（共享模块）：从 BoardCanvas 抽出，供棋盘实时绘制与商店预览循环共用。
// 每个特效都是一段 720ms 的绽放动画，由外部传入已用时间 elapsed 驱动进度，纯函数无副作用（除落尘粒子数据）。

// 2π常量（动画常用）。
const PI2 = Math.PI * 2
// 单次特效总时长（ms）；超过此时长特效绘制自动停止。
const DUR = 720

// 灰尘/迸屑粒子：从落点向外飞散并渐隐（简单物理：位置=速度*时间 + 轻微重力）。
export interface Dust {
  a: number // 飞散角度
  sp: number // 速度系数
  r0: number // 初始半径
  col: string // 粒子颜色（木屑/金光混合，更有层次）
}

// 生成一组落尘粒子（尘屑特效用）。
export function makeDust(): Dust[] {
  return Array.from({ length: 24 }, () => ({
    a: Math.random() * PI2,
    sp: 0.8 + Math.random() * 2.2,
    r0: 1.5 + Math.random() * 3,
    col: ['#e9d3a5', '#c9a35b', '#fff2c0', '#a8763a'][Math.floor(Math.random() * 4)],
  }))
}

// 特效总时长（供外部计时循环引用）。
export const EFFECT_DUR = DUR

// 在 (cx,cy) 处绘制指定特效，elapsed 为动画已进行毫秒数，accent 为主题强调色。
// cell 为特效尺度（原棋盘格距 40），预览缩小预览时传入较小值以等比缩放；dust 仅尘屑特效需要。
export function drawEffect(
  ctx: CanvasRenderingContext2D,
  effect: string,
  dust: Dust[],
  cx: number,
  cy: number,
  elapsed: number,
  accent: string,
  cell = 40,
) {
  if (elapsed > DUR) return
  const p = elapsed / DUR
  ctx.save()
  ctx.lineCap = 'round'
  if (effect === 'ripple') {
    // 水波：带填充色的同心波纹环带，逐圈向外扩大、渐隐（暖金涟漪）。
    for (let i = 0; i < 3; i++) {
      const e = elapsed - i * 160
      if (e < 0) continue
      const q = e / DUR
      if (q >= 1) continue
      const R = cell * (0.24 + q * 1.25)
      const inner = Math.max(0.01, R - cell * 0.5)
      const al = (1 - q) * 0.55
      const g = ctx.createRadialGradient(cx, cy, inner, cx, cy, R)
      g.addColorStop(0, 'rgba(255,236,180,0)')
      g.addColorStop(0.5, `rgba(255,232,168,${al})`)
      g.addColorStop(0.82, `rgba(255,212,120,${al})`)
      g.addColorStop(1, 'rgba(255,205,90,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, PI2)
      ctx.fill()
    }
  } else if (effect === 'dust') {
    // 火花：迸射亮点(带下坠) + 放射火花线，暖金，更大更明显。
    for (const d of dust) {
      const dist = d.sp * elapsed * 0.2
      const px = cx + Math.cos(d.a) * dist
      const py = cy + Math.sin(d.a) * dist + 0.0009 * elapsed * elapsed * 0.5
      ctx.globalAlpha = (1 - p) * 0.95
      ctx.fillStyle = d.col
      ctx.beginPath()
      ctx.arc(px, py, Math.max(0.8, d.r0 * 1.5 * (1 - p * 0.5)), 0, PI2)
      ctx.fill()
    }
    ctx.globalAlpha = (1 - p) * 0.9
    ctx.strokeStyle = '#ffd98a'
    ctx.lineWidth = 3 * (1 - p) + 0.6
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI2
      const r0 = cell * (0.3 + p * 0.7)
      const r1 = r0 + cell * 0.5 * (1 - p)
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      ctx.stroke()
    }
  } else if (effect === 'ink') {
    // 墨韵：深墨晕扩散 + 墨点飞溅（水墨风，更大更浓）。
    const rr = cell * (0.34 + p * 1.0)
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr)
    g.addColorStop(0, `rgba(18,16,26,${0.5 * (1 - p)})`)
    g.addColorStop(0.62, `rgba(28,24,40,${0.28 * (1 - p)})`)
    g.addColorStop(1, 'rgba(28,24,40,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, rr, 0, PI2)
    ctx.fill()
    ctx.fillStyle = `rgba(14,12,20,${0.6 * (1 - p)})`
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * PI2 + 0.5
      const d = cell * (0.3 + p * 0.9)
      ctx.beginPath()
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(0.8, 4 * (1 - p)), 0, PI2)
      ctx.fill()
    }
  } else if (effect === 'star') {
    // 星星：中心大星 + 几颗小星绕子绽放、缓旋、渐隐，更大更亮。
    ctx.globalAlpha = (1 - p) * 0.98
    ctx.fillStyle = '#fff0b0'
    drawStar5(ctx, cx, cy - cell * (0.1 + p * 0.5), Math.max(0.5, cell * 0.34 * (1 - p * 0.5)), p * 1.2)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * PI2 + p * 0.7
      const d = cell * (0.4 + p * 0.85)
      const sx = cx + Math.cos(a) * d
      const sy = cy + Math.sin(a) * d
      const sr = Math.max(0.5, cell * 0.24 * (1 - p * 0.4))
      ctx.fillStyle = i % 2 ? '#ffe66a' : accent
      drawStar5(ctx, sx, sy, sr, a)
    }
  } else if (effect === 'flame') {
    // 流焰：暖色火焰核 + 几束火舌向上升腾，更大更旺。
    const fy = cy - p * cell * 0.3
    const gr = cell * (0.5 + p * 0.3)
    const gg = ctx.createRadialGradient(cx, fy, 0, cx, fy, gr)
    gg.addColorStop(0, `rgba(255,190,80,${0.6 * (1 - p)})`)
    gg.addColorStop(0.6, `rgba(255,110,40,${0.35 * (1 - p)})`)
    gg.addColorStop(1, 'rgba(255,90,30,0)')
    ctx.fillStyle = gg
    ctx.beginPath()
    ctx.arc(cx, fy, gr, 0, PI2)
    ctx.fill()
    const cols = ['#ffd24a', '#ff9a3c', '#ff5a2a']
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * PI2
      const spread = cell * (0.16 + p * 0.5)
      const px = cx + Math.cos(a) * spread
      const py = cy + Math.sin(a) * spread - p * cell * 1.0
      const r = Math.max(0.8, cell * 0.24 * (1 - p))
      ctx.globalAlpha = (1 - p) * 0.95
      ctx.fillStyle = cols[i % cols.length]
      ctx.beginPath()
      ctx.arc(px, py, r, 0, PI2)
      ctx.fill()
    }
  } else if (effect === 'heart') {
    // 爱心：几颗大爱心向上飘散、渐隐（粉红，明显）。
    const cols = ['#ff5c82', '#ff85a6', '#ff3d68']
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI2 + 0.4
      const spread = cell * (0.18 + p * 0.5)
      const hx = cx + Math.cos(a) * spread
      const hy = cy + Math.sin(a) * spread - p * cell * 1.05
      const hr = Math.max(0.6, cell * 0.38 * (1 - p * 0.3))
      ctx.globalAlpha = (1 - p) * 0.95
      ctx.fillStyle = cols[i % cols.length]
      drawHeart(ctx, hx, hy, hr)
    }
  }
  // 'none'：不额外绘制。
  ctx.restore()
}

// 五角星（填充）：中心 (cx,cy)、外径 r、旋转 rot。
function drawStar5(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number) {
  const inner = r * 0.45
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : inner
    const a = rot + (i / 10) * PI2 - Math.PI / 2
    const x = cx + Math.cos(a) * rr
    const y = cy + Math.sin(a) * rr
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

// 爱心（填充）：中心 (cx,cy)、尺寸 r。
function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const top = cy - r * 0.3
  ctx.beginPath()
  ctx.moveTo(cx, cy + r * 0.7)
  ctx.bezierCurveTo(cx - r * 1.1, cy - r * 0.2, cx - r * 0.55, top - r * 0.9, cx, top)
  ctx.bezierCurveTo(cx + r * 0.55, top - r * 0.9, cx + r * 1.1, cy - r * 0.2, cx, cy + r * 0.7)
  ctx.closePath()
  ctx.fill()
}

// 预览画布的强调色与背景色（与 wood 主题一致，供商店预览复用）。
export function previewPalette(): { accent: string; bg: string } {
  return { accent: '#8a2b2b', bg: '#efdcb4' }
}

// 在预览画布上绘制一枚棋子（径向渐变玻璃子）+ 指定特效，供商店预览循环复用。
// stoneR 为棋子半径（像素），特效尺度按 stoneR 等比缩放（棋盘里棋子半径≈cell*0.42）。
export function drawStoneWithEffect(
  ctx: CanvasRenderingContext2D,
  effect: string,
  dust: Dust[],
  cx: number,
  cy: number,
  elapsed: number,
  accent: string,
  stoneR: number,
) {
  const cell = stoneR / 0.42 // 特效尺度随棋子半径等比缩放
  // 棋子本体（径向渐变，高光偏左上）。
  const g = ctx.createRadialGradient(cx - stoneR * 0.35, cy - stoneR * 0.35, stoneR * 0.1, cx, cy, stoneR)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.55, '#f4f0e6')
  g.addColorStop(1, '#c9bfa6')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, stoneR, 0, PI2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'rgba(120,100,60,0.4)'
  ctx.stroke()
  // 特效叠在棋子之上。
  drawEffect(ctx, effect, dust, cx, cy, elapsed, accent, cell)
}
