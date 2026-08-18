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

const CAP = 6 // 每个节点最多考虑的候选点数

// 判断 (x,y) 刚落下的 color 子是否构成"活四"：四连且两端皆空。
// 活四是必胜（对手一手只能堵一端），浅层搜索常停在"双方各一活四"的叶子而漏判，
// 这里用于预处理：己方成四直接走、对方成四必须堵。
function createsLiveFour(board: Board, x: number, y: number): boolean {
  const color = board[y][x]
  if (!color) return false
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]] as const) {
    let n = 1
    let ax = x + dx, ay = y + dy
    while (ax >= 0 && ay >= 0 && ax < SIZE && ay < SIZE && board[ay][ax] === color) { n++; ax += dx; ay += dy }
    let bx = x - dx, by = y - dy
    while (bx >= 0 && by >= 0 && bx < SIZE && by < SIZE && board[by][bx] === color) { n++; bx -= dx; by -= dy }
    if (n === 4) {
      const lo = ax >= 0 && ay >= 0 && ax < SIZE && ay < SIZE && board[ay][ax] === null
      const ro = bx >= 0 && by >= 0 && bx < SIZE && by < SIZE && board[by][bx] === null
      if (lo && ro) return true
    }
  }
  return false
}

// 返回 color 一手即可成活四的落点集合。
function liveFourPoints(board: Board, color: Color): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = []
  for (const c of candidates(board)) {
    const nb = applyMove(board, { x: c.x, y: c.y, color })
    if (createsLiveFour(nb, c.x, c.y)) pts.push(c)
  }
  return pts
}

// 在候选点里挑"落子后己方评估最高"的一个。
function pickBest(board: Board, color: Color, pts: { x: number; y: number }[]): { x: number; y: number } {
  let best = -Infinity
  let choice = pts[0]
  for (const c of pts) {
    const s = evaluate(applyMove(board, { x: c.x, y: c.y, color }), color)
    if (s > best) { best = s; choice = c }
  }
  return choice
}

// —— 对方"一手做成双威胁(4-3/双三/双四)"的识别：过某落点有 ≥2 条线同时成"必须应"威胁 ——
// s：以落点为中心、沿某方向 ±4 的 9 格窗口串（o=同色, .=空, x=对方/界外）。
// makesFive：某空格补成 o 后出现连五（=该线为冲四/活四）。
function makesFive(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '.') continue
    if ((s.slice(0, i) + 'o' + s.slice(i + 1)).includes('ooooo')) return true
  }
  return false
}
// makesOpenFour：某空格补成 o 后出现活四 `.oooo.`（=该线为活三，含可成活四的跳三）。
function makesOpenFour(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '.') continue
    if ((s.slice(0, i) + 'o' + s.slice(i + 1)).includes('.oooo.')) return true
  }
  return false
}
const FORK_DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]] as const
// 统计在 (x,y) 落子后，过该点四条线中「必须应」威胁（活三/冲四/活四）的数量。≥2 即杀招双威胁。
function forkThreatsAt(board: Board, x: number, y: number): number {
  const color = board[y][x]
  if (!color) return 0
  let n = 0
  for (const [dx, dy] of FORK_DIRS) {
    let s = ''
    for (let k = -4; k <= 4; k++) {
      const nx = x + dx * k, ny = y + dy * k
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) s += 'x'
      else { const c = board[ny][nx]; s += c === color ? 'o' : c === null ? '.' : 'x' }
    }
    if (s.includes('ooooo') || makesFive(s) || makesOpenFour(s)) n++
  }
  return n
}

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
// opts.tieRandom=true 时，最高分并列的候选点随机取一（提示用，避免总指同一点）；
// AI 实际落子不传该选项，保持确定性。
export function bestMove(board: Board, color: Color, level: number, opts?: { tieRandom?: boolean }): Move {
  const depth = level >= 3 ? 8 : level === 2 ? 6 : 4
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

  // 3. 己方一手可成活四：双端开放的必胜四，直接走。
  //    需先于"堵对方活三"——己方先成四则对方来不及应，比防守更优先。
  const myFour = liveFourPoints(board, color)
  if (myFour.length) return { ...pickBest(board, color, myFour), color }

  // 4. 对方活三威胁（仅浅层搜索）：对方一手可成活四（再一手成五），己方无更快胜招时必须堵。
  //    只对 Lv1(深度3) 生效——深度 3 会停在"双方各一活四"的叶子而漏判对方活三必胜；
  //    Lv2/Lv3 搜索已能正确处理，若再加压会强行打断其进攻节奏（自对弈实测拖垮胜率）。
  //    只堵"堵完对方不再有成四点"的落点；多路威胁堵不完则交给搜索自行处理。
  if (level === 1) {
    const oppFour = liveFourPoints(board, opp)
    if (oppFour.length) {
      const blocks = oppFour.filter((c) => liveFourPoints(applyMove(board, { x: c.x, y: c.y, color }), opp).length === 0)
      if (blocks.length) return { ...pickBest(board, color, blocks), color }
    }
  }

  // 4.5. 对方一步可成"杀招双威胁"(4-3 / 双三 / 双四)：过对方落点有 ≥2 条线同时成必应威胁。
  //      这类点浅层搜索看不到、且其"四"多为冲四(createsLiveFour 识别不到)，第4步会漏掉，必须显式抢占。
  //      仅 Lv1；命中即确定性封堵（不加噪声），白占对方关键双威胁点。
  if (level === 1) {
    const forks = cands.filter(
      (c) => forkThreatsAt(applyMove(board, { x: c.x, y: c.y, color: opp }), c.x, c.y) >= 2,
    )
    if (forks.length) return { ...pickBest(board, color, forks), color }
  }

  // 5. 常规搜索：对（排序后的）候选点做负极大值 + α-β 搜索取最优。
  let best = -Infinity
  let choice = cands[0] ?? { x: 7, y: 7 }
  const ties: { x: number; y: number }[] = []
  for (const c of orderedCandidates(board, color, CAP)) {
    const nb = applyMove(board, { x: c.x, y: c.y, color })
    let score = -negamax(nb, opp, depth - 1, -Infinity, Infinity, c.x, c.y)
    if (noise) score += (Math.random() - 0.5) * Math.abs(score || 1) * noise
    if (score > best) {
      best = score
      choice = c
      ties.length = 0
      ties.push(c)
    } else if (score === best) {
      ties.push(c)
    }
  }
  if (opts?.tieRandom && ties.length > 1) {
    choice = ties[Math.floor(Math.random() * ties.length)]
  }
  return { ...choice, color }
}
