import { describe, it, expect } from 'vitest'
import { emptyBoard } from '../core/types'
import type { Board, Color, Move } from '../core/types'
import { applyMove } from '../core/board'
import { checkWin } from '../core/win'
import { bestMove } from './search'
import { evaluate } from './evaluate'

function put(b: Board, pts: [number, number][], color: Color): Board {
  let nb = b
  for (const [x, y] of pts) nb = applyMove(nb, { x, y, color })
  return nb
}

describe('新评估：跳形棋型', () => {
  it('跳冲四 X_XXX 应远高于活三 _XXX_', () => {
    const jumpFour = put(emptyBoard(), [[3,7],[5,7],[6,7],[7,7]], 'black') // X_XXX
    const liveThree = put(emptyBoard(), [[3,7],[4,7],[5,7]], 'black') // _XXX_
    const a = evaluate(jumpFour, 'black')
    const b = evaluate(liveThree, 'black')
    console.log(`跳冲四=${a} 活三=${b}`)
    expect(a).toBeGreaterThan(b * 5) // 跳冲四威胁远大于活三
  })
  it('双活三(分叉)应远高于单个活三', () => {
    // 横活三 + 竖活三（共享交点的双三）
    const fork = put(emptyBoard(), [[5,7],[6,7],[7,7],[7,5],[7,6]], 'black')
    const single = put(emptyBoard(), [[5,7],[6,7],[7,7]], 'black')
    const a = evaluate(fork, 'black')
    const b = evaluate(single, 'black')
    console.log(`双活三=${a} 单活三=${b}`)
    expect(a).toBeGreaterThan(b * 2) // 分叉加成让连杀结构价值凸显
  })
  it('双跳三连杀：黑应下交点 (7,7)', () => {
    const b = put(emptyBoard(), [[4,7],[6,7],[7,4],[7,6]], 'black')
    const mv = bestMove(b, 'black', 3)
    console.log('双跳三落子:', mv.x, mv.y)
    expect(mv.x === 7 && mv.y === 7).toBe(true)
  })
  it('对方跳三 X_XX，黑应封堵', () => {
    const b = put(emptyBoard(), [[3,7],[5,7],[6,7]], 'white')
    const mv = bestMove(b, 'black', 2)
    const good = [[2,7],[4,7],[7,7]].some(([x, y]) => mv.x === x && mv.y === y)
    console.log('堵跳三(Lv2):', mv.x, mv.y, good)
    expect(good).toBe(true)
  })
  it('己方 X_XX 跳三，黑应补成跳四 (4,5)', () => {
    const b = put(emptyBoard(), [[3,5],[5,5],[6,5]], 'black')
    const mv = bestMove(b, 'black', 2)
    console.log('补跳四(Lv2):', mv.x, mv.y)
    expect(mv.x === 4 && mv.y === 5).toBe(true)
  })
})

// 贪心对手：能赢就赢、能堵就堵，否则按当前评估下。作为 AI 的基准参照。
function greedy(board: Board, color: Color): Move {
  const opp: Color = color === 'black' ? 'white' : 'black'
  const cs: { x: number; y: number }[] = []
  const set = new Set<number>()
  for (let y = 0; y < 15; y++)
    for (let x = 0; x < 15; x++)
      if (board[y][x]) {
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx >= 0 && ny >= 0 && nx < 15 && ny < 15 && !board[ny][nx]) set.add(ny * 15 + nx)
          }
      }
  for (const v of set) cs.push({ x: v % 15, y: Math.floor(v / 15) })
  for (const c of cs) {
    if (checkWin(applyMove(board, { x: c.x, y: c.y, color }), c.x, c.y)) return { ...c, color }
  }
  for (const c of cs) {
    if (checkWin(applyMove(board, { x: c.x, y: c.y, color: opp }), c.x, c.y)) return { ...c, color }
  }
  let best = -Infinity, choice = cs[0] ?? { x: 7, y: 7 }
  for (const c of cs) {
    const s = evaluate(applyMove(board, { x: c.x, y: c.y, color }), color)
    if (s > best) { best = s; choice = c }
  }
  return { ...choice, color }
}

function play(black: (b: Board, c: Color) => Move, white: (b: Board, c: Color) => Move, label: string, maxMoves = 90) {
  let b = emptyBoard()
  for (let i = 0; i < maxMoves; i++) {
    const color: Color = i % 2 === 0 ? 'black' : 'white'
    const mv = (color === 'black' ? black : white)(b, color)
    if (b[mv.y][mv.x] !== null) {
      console.log(`[${label}] 非法落子 @ (${mv.x},${mv.y})`)
      return 'illegal'
    }
    b = applyMove(b, mv)
    if (checkWin(b, mv.x, mv.y)) {
      console.log(`[${label}] 第 ${i + 1} 手 ${color} 获胜`)
      return color
    }
  }
  console.log(`[${label}] 无胜负(${maxMoves}手)`)
  return 'draw'
}

describe('新评估：自对弈/对练', () => {
  it('Lv3 执黑 vs 贪心白：应获胜', { timeout: 120000 }, () => {
    const r = play((b, c) => bestMove(b, c, 3), greedy, 'Lv3黑vs贪心白')
    expect(r).toBe('black')
  })
  it('贪心黑 vs Lv3 执白：应获胜', { timeout: 120000 }, () => {
    const r = play(greedy, (b, c) => bestMove(b, c, 3), '贪心黑vsLv3白')
    expect(r).toBe('white')
  })
  it('Lv2 vs Lv2：应能分出胜负（修复前是 100 手填盘）', { timeout: 120000 }, () => {
    const r = play((b, c) => bestMove(b, c, 2), (b, c) => bestMove(b, c, 2), 'Lv2 vs Lv2', 80)
    expect(r).not.toBe('draw')
  })
  // Lv1 带随机扰动（故意让新手能赢），对局结果不稳定，仅观察无非法落子即可。
  it('Lv1 vs Lv1：应无非法落子', { timeout: 60000 }, () => {
    const r = play((b, c) => bestMove(b, c, 1), (b, c) => bestMove(b, c, 1), 'Lv1 vs Lv1', 80)
    expect(r).not.toBe('illegal')
  })
})
