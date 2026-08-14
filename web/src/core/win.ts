import type { Board, Color } from './types'
import { SIZE } from './types'
const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]]
export function checkWin(board: Board, x: number, y: number): Color | null {
  const color = board[y][x]
  if (!color) return null
  for (const [dx, dy] of DIRS) {
    let count = 1
    for (const sign of [1, -1]) {
      let nx = x + dx * sign
      let ny = y + dy * sign
      while (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[ny][nx] === color) {
        count++
        nx += dx * sign
        ny += dy * sign
      }
    }
    if (count >= 5) return color
  }
  return null
}

// 返回经过 (x,y) 的获胜连线上的全部同色棋子坐标（长度>=5）；无则 null。
// 对每个方向：以 (x,y) 为中心向正负两侧延伸，收集最长的连续同色段；
// 若某方向长度>=5，则返回该段坐标（沿方向排序，从负向端到正向端）。
export function winningLine(
  board: Board,
  x: number,
  y: number,
): { x: number; y: number }[] | null {
  const color = board[y][x]
  if (!color) return null
  for (const [dx, dy] of DIRS) {
    // 向负向端回退到该段起点。
    let sx = x
    let sy = y
    while (
      sx - dx >= 0 &&
      sy - dy >= 0 &&
      sx - dx < SIZE &&
      sy - dy < SIZE &&
      board[sy - dy][sx - dx] === color
    ) {
      sx -= dx
      sy -= dy
    }
    // 从起点沿正向收集连续同色棋子。
    const cells: { x: number; y: number }[] = []
    let cx = sx
    let cy = sy
    while (cx >= 0 && cy >= 0 && cx < SIZE && cy < SIZE && board[cy][cx] === color) {
      cells.push({ x: cx, y: cy })
      cx += dx
      cy += dy
    }
    if (cells.length >= 5) return cells
  }
  return null
}
