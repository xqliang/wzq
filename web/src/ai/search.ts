import type { Board, Color, Move } from '../core/types'
import { SIZE } from '../core/types'
import { applyMove } from '../core/board'
import { checkWin } from '../core/win'
import { evaluate } from './evaluate'

// 候选着法生成：只考虑已有棋子周围 2 格范围内的空位，缩小搜索分支。
// 空盘则直接返回天元中心点。
function candidates(board: Board): { x: number; y: number }[] {
  const set = new Set<number>()
  let hasStone = false
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (board[y][x]) {
        hasStone = true
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx, ny = y + dy
            if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && !board[ny][nx])
              set.add(ny * SIZE + nx)
          }
      }
  if (!hasStone) return [{ x: 7, y: 7 }]
  return [...set].map((v) => ({ x: v % SIZE, y: Math.floor(v / SIZE) }))
}

// 按启发式（落子后的局面评估）对候选点排序并截断，既提升 α-β 剪枝效率，也聚焦要点。
function orderedCandidates(board: Board, color: Color, cap: number): { x: number; y: number }[] {
  const cs = candidates(board)
  if (cs.length <= 1) return cs
  const scored = cs.map((c) => ({
    c,
    s: evaluate(applyMove(board, { x: c.x, y: c.y, color }), color),
  }))
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, cap).map((o) => o.c)
}

const CAP = 12 // 每个节点最多考虑的候选点数

// 负极大值搜索 + α-β 剪枝。lastX/lastY 为对手刚落子的位置，用于快速判定是否已经形成五连。
function negamax(board: Board, color: Color, depth: number, alpha: number, beta: number, lastX: number, lastY: number): number {
  // 对手上一手已经连五 => 当前视角是必败局面，深度越浅（越早败）惩罚越重
  if (lastX >= 0 && checkWin(board, lastX, lastY)) return -1000000 - depth
  if (depth === 0) return evaluate(board, color)
  const opp: Color = color === 'black' ? 'white' : 'black'
  let best = -Infinity
  for (const c of orderedCandidates(board, color, CAP)) {
    const nb = applyMove(board, { x: c.x, y: c.y, color })
    // 递归取对手视角得分的相反数（negamax 框架）
    const score = -negamax(nb, opp, depth - 1, -beta, -alpha, c.x, c.y)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break // β 剪枝
  }
  return best
}

// 顶层决策：根据难度决定搜索深度与随机扰动，返回最佳落子。
export function bestMove(board: Board, color: Color, level: number): Move {
  const depth = level >= 3 ? 6 : level === 2 ? 4 : 3
  const noise = level === 1 ? 0.2 : 0 // 简单档加入随机性，让 AI 偶尔“走歪”
  const opp: Color = color === 'black' ? 'white' : 'black'
  const cands = candidates(board)

  // 1. 己方一步即可连五：直接制胜。
  for (const c of cands) {
    const nb = applyMove(board, { x: c.x, y: c.y, color })
    if (checkWin(nb, c.x, c.y)) return { x: c.x, y: c.y, color }
  }
  // 2. 对方一步即可连五：抢占该点封堵。
  //    这一步很关键——纯极大极小搜索在“必败局面”（如对方活四）下，
  //    所有分支得分相同会退化为返回首个候选点；显式封堵才能表现出合理防守。
  for (const c of cands) {
    const nb = applyMove(board, { x: c.x, y: c.y, color: opp })
    if (checkWin(nb, c.x, c.y)) return { x: c.x, y: c.y, color }
  }

  // 3. 常规搜索：对（排序后的）候选点做负极大值 + α-β 搜索取最优。
  let best = -Infinity
  let choice = cands[0] ?? { x: 7, y: 7 }
  for (const c of orderedCandidates(board, color, CAP)) {
    const nb = applyMove(board, { x: c.x, y: c.y, color })
    let score = -negamax(nb, opp, depth - 1, -Infinity, Infinity, c.x, c.y)
    if (noise) score += (Math.random() - 0.5) * Math.abs(score || 1) * noise
    if (score > best) { best = score; choice = c }
  }
  return { ...choice, color }
}
