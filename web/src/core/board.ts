import { Board, Move, SIZE } from './types'
export function isLegal(board: Board, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return false
  return board[y][x] === null
}
export function applyMove(board: Board, move: Move): Board {
  const next = board.map((row) => row.slice())
  next[move.y][move.x] = move.color
  return next
}
