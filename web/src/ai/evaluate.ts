import type { Board, Color } from '../core/types'
import { SIZE } from '../core/types'

// 四个基本方向：水平、垂直、正斜、反斜
const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]]
// 不同连子长度对应的基础分值，长度越大分值越高
const SCORE: Record<number, number> = { 1: 10, 2: 100, 3: 1000, 4: 10000, 5: 1000000 }

// 计算以 (x,y) 为起点、沿 (dx,dy) 方向的一条连线的得分。
// 为避免同一条线被重复统计，只有当该方向的“前一格”不是同色时，才把当前点视为线段起点。
function lineScore(board: Board, x: number, y: number, dx: number, dy: number, color: Color): number {
  const px = x - dx, py = y - dy
  // 前一格是同色 => 说明当前点不是线段起点，跳过，避免重复计分
  if (px >= 0 && py >= 0 && px < SIZE && py < SIZE && board[py][px] === color) return 0
  // 从当前点开始，沿方向统计连续同色棋子的数量
  let count = 0, cx = x, cy = y
  while (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === color) {
    count++; cx += dx; cy += dy
  }
  if (count === 0) return 0
  // 统计线段两端的“空位”数量（活/眠），open 越大越有威胁
  let open = 0
  const bx = x - dx, by = y - dy
  if (bx >= 0 && by >= 0 && bx < SIZE && by < SIZE && board[by][bx] === null) open++
  if (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === null) open++
  const base = SCORE[Math.min(count, 5)] ?? 0
  // 两端均被堵死（死棋）且未成五：分值大幅衰减；两端皆空（活）：略加权
  return open === 0 && count < 5 ? base * 0.1 : base * (open === 2 ? 1.2 : 1)
}

// 站在 color 的视角评估整个棋盘：己方得分 - 对方得分（对方略微加权以偏向防守）
export function evaluate(board: Board, color: Color): number {
  let self = 0, other = 0
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = board[y][x]
      if (!c) continue
      for (const [dx, dy] of DIRS) {
        const s = lineScore(board, x, y, dx, dy, c)
        if (c === color) self += s
        else other += s
      }
    }
  }
  return self - other * 1.1
}
