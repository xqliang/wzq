import { Board, Color, SIZE } from './types'
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
