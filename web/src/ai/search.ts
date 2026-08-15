import type { Board, Color, Move } from '../core/types'
import { SIZE } from '../core/types'
import { applyMove } from '../core/board'
import { checkWin } from '../core/win'
import { evaluate } from './evaluate'

// 四个基本方向：水平、垂直、正斜、反斜
const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]]

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

// ---------------------------------------------------------------------------
// 战术层（根节点局部威胁识别）
// 纯 negamax + 快速评估函数对“断三/跳四/双威胁”识别不敏感，容易走出人类一眼
// 就能看出的软弱棋（只堵不攻、漏防双三）。这里在搜索之前，用一个针对单个落点、
// 只扫描该点四条线 ±5 窗口的“局部模式识别”给出强制着法，既准确又不影响搜索耗时。
// ---------------------------------------------------------------------------

// 单点四个方向上形成的威胁类别计数（互斥：每个方向只归入最高的一类）。
interface Threats { five: number; openFour: number; four: number; open3: number }

const RE_FIVE = /11111/ // 连五
const RE_OPEN4 = /011110/ // 活四：两端皆空，无法阻挡
const RE_FOUR = /11110|01111|11011|10111|11101/ // 冲四/断四：一步即可成五
const RE_OPEN3 = /011100|001110|010110|011010/ // 活三：可延伸为活四（含跳三）

// 以 (x,y) 为中心、沿 (dx,dy) 取 ±5 的一维窗口串。
// 己方子记 '1'，空位记 '0'，对手子或越界（墙）记 '#'。落子前需已在 (x,y) 放好该色子。
function dirString(board: Board, x: number, y: number, dx: number, dy: number, color: Color): string {
  let s = ''
  for (let i = -5; i <= 5; i++) {
    const nx = x + dx * i, ny = y + dy * i
    if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) { s += '#'; continue }
    const c = board[ny][nx]
    s += c === color ? '1' : c == null ? '0' : '#'
  }
  return s
}

// 在 (x,y) 落一枚 color 棋后，统计四个方向上形成的威胁类别（临时落子后复原，不改动传入棋盘）。
function countThreats(board: Board, x: number, y: number, color: Color): Threats {
  const prev = board[y][x]
  board[y][x] = color
  const t: Threats = { five: 0, openFour: 0, four: 0, open3: 0 }
  for (const [dx, dy] of DIRS) {
    const s = dirString(board, x, y, dx, dy, color)
    if (RE_FIVE.test(s)) t.five++
    else if (RE_OPEN4.test(s)) t.openFour++
    else if (RE_FOUR.test(s)) t.four++
    else if (RE_OPEN3.test(s)) t.open3++
  }
  board[y][x] = prev
  return t
}

// 该落点是否构成“必胜级”威胁：活四 / 双四 / 四三，对手一手无法同时化解。
function isWinningThreat(t: Threats): boolean {
  const fours = t.openFour + t.four
  return t.openFour > 0 || fours >= 2 || (fours >= 1 && t.open3 >= 1)
}

// 强制性进攻点：至少一个冲四，或双活三，逼迫对手必须应招（也用于封堵对手同类威胁）。
function isPush(t: Threats): boolean {
  const fours = t.openFour + t.four
  return fours >= 1 || t.open3 >= 2
}

// 给威胁点一个可比较的分值，便于在多个进攻/防守点中挑最狠的一个。
function threatScore(t: Threats): number {
  const fours = t.openFour + t.four
  if (t.five) return 1e9
  if (t.openFour) return 5e8
  if (fours >= 2 || (fours >= 1 && t.open3 >= 1)) return 3e8 // 双四 / 四三
  if (fours >= 1) return 5e6 // 冲四
  if (t.open3 >= 2) return 4e6 // 双活三
  if (t.open3 >= 1) return 5e5 // 单活三
  return 0
}

// 顶层决策：先用战术层给出强制着法（进攻优先、兼顾封堵），无强制点再退回负极大值搜索。
export function bestMove(board: Board, color: Color, level: number): Move {
  const depth = level >= 3 ? 6 : level === 2 ? 4 : 2
  const noise = level === 1 ? 0.25 : 0 // 简单档加入随机性，让 AI 偶尔“走歪”
  const opp: Color = color === 'black' ? 'white' : 'black'
  const cands = candidates(board)

  // 一次遍历，分别记录：己方/对手 的连五点、必胜威胁点、强制进攻点（各取威胁分最高者）。
  let selfWin: { x: number; y: number } | null = null
  let oppWin: { x: number; y: number } | null = null
  let selfWinThreat: { x: number; y: number } | null = null, selfWinThreatS = -1
  let oppWinThreat: { x: number; y: number } | null = null, oppWinThreatS = -1
  let selfPush: { x: number; y: number } | null = null, selfPushS = -1
  let oppPush: { x: number; y: number } | null = null, oppPushS = -1

  for (const c of cands) {
    const ts = countThreats(board, c.x, c.y, color) // 己方在此落子的威胁
    if (ts.five && !selfWin) selfWin = c
    if (isWinningThreat(ts)) { const s = threatScore(ts); if (s > selfWinThreatS) { selfWinThreatS = s; selfWinThreat = c } }
    if (isPush(ts)) { const s = threatScore(ts); if (s > selfPushS) { selfPushS = s; selfPush = c } }

    const to = countThreats(board, c.x, c.y, opp) // 对手在此落子的威胁（用于封堵）
    if (to.five && !oppWin) oppWin = c
    if (isWinningThreat(to)) { const s = threatScore(to); if (s > oppWinThreatS) { oppWinThreatS = s; oppWinThreat = c } }
    if (isPush(to)) { const s = threatScore(to); if (s > oppPushS) { oppPushS = s; oppPush = c } }
  }

  // 1. 己方一步连五 → 直接取胜。
  if (selfWin) return { ...selfWin, color }
  // 2. 对手一步连五 → 必须封堵。
  if (oppWin) return { ...oppWin, color }
  // 3. 己方可形成必胜威胁（活四/四三/双四）→ 主动进攻，抢先手。
  if (selfWinThreat) return { ...selfWinThreat, color }
  // 4. 对手可形成必胜威胁 → 提前封堵，破坏其杀棋。
  if (oppWinThreat) return { ...oppWinThreat, color }
  // 5. 己方强制进攻点（冲四/双活三）→ 中高级主动扩大优势；简单档留给搜索，保持“可赢但不碾压”。
  if (level >= 2 && selfPush) return { ...selfPush, color }
  // 6. 对手强制点（含双活三）→ 封堵，避免被对方先手连续威胁压制（即“避免对方出现双三”）。
  if (oppPush) return { ...oppPush, color }

  // 7. 无强制着法：对（排序后的）候选点做负极大值 + α-β 搜索取最优。
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
