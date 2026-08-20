import { useEffect, useRef } from 'react'
import { drawStoneWithEffect, makeDust, EFFECT_DUR, previewPalette } from '../board/effects'
import type { Dust } from '../board/effects'

// 单个动效循环预览：在卡片内循环播放「这一个」动效（播放 720ms → 间隔 1s → 再播），周而复始。
// 供商店「落子」tab 的每个商品卡展示各自的动效（如水波卡只循环水波，尘屑卡只循环尘屑）。
export function EffectLoopPreview({ effect, height = 72 }: { effect: string; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const effectRef = useRef(effect)
  effectRef.current = effect

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const W = cv.clientWidth || 100
    const H = height
    cv.width = W * dpr
    cv.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const { accent } = previewPalette()
    const stoneR = H * 0.22 // 棋子半径随画布高度自适应
    const cx = W / 2
    const cy = H / 2
    const GAP = 1000 // 每次播放之间的间隔（ms）
    const cycle = EFFECT_DUR + GAP

    let dust: Dust[] = makeDust()
    let raf = 0
    const start = performance.now()
    let prevWithin = -1
    const loop = (now: number) => {
      const eff = effectRef.current
      const within = (now - start) % cycle
      // 跨过一轮（within 回绕）时重生尘屑粒子，让每次播放的迸射都不同。
      if (within < prevWithin && eff === 'dust') dust = makeDust()
      prevWithin = within
      const elapsed = Math.min(within, EFFECT_DUR)

      ctx.clearRect(0, 0, W, H)
      drawStoneWithEffect(ctx, eff, dust, cx, cy, elapsed, accent, stoneR)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [effect, height])

  return <canvas ref={canvasRef} className="effect-loop" style={{ width: '100%', height, background: previewPalette().bg + '55', borderRadius: 10 }} />
}
