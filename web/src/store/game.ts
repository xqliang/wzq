import { create } from 'zustand'
import { emptyBoard } from '../core/types'
import type { Board, Color } from '../core/types'
import { applyMove } from '../core/board'
import { checkWin } from '../core/win'

// 对局状态：棋盘、当前轮次、我方执子、预落子、最近一手、胜方。
interface GameState {
  board: Board
  turn: Color
  myColor: Color
  pending: { x: number; y: number } | null
  lastMove: { x: number; y: number } | null
  winner: Color | null
  reset: (myColor: Color) => void
  preview: (x: number, y: number) => void
  cancel: () => void
  confirm: () => void
  place: (x: number, y: number, color: Color) => void // 用于对手落子/回放
}

export const useGame = create<GameState>((set, get) => ({
  board: emptyBoard(),
  turn: 'black',
  myColor: 'black',
  pending: null,
  lastMove: null,
  winner: null,
  // 重置整局，指定我方执子颜色（黑先）。
  reset: (myColor) =>
    set({ board: emptyBoard(), turn: 'black', myColor, pending: null, lastMove: null, winner: null }),
  // 预落子：仅当目标点为空时记录待确认坐标。
  preview: (x, y) => {
    const { board } = get()
    if (board[y][x] === null) set({ pending: { x, y } })
  },
  // 取消预落子。
  cancel: () => set({ pending: null }),
  // 确认预落子：按当前轮次落子并清空 pending。
  confirm: () => {
    const { pending, turn } = get()
    if (!pending) return
    get().place(pending.x, pending.y, turn)
    set({ pending: null })
  },
  // 落子写盘：应用落子、判胜、记录最近一手并切换轮次。
  place: (x, y, color) => {
    const board = applyMove(get().board, { x, y, color })
    const winner = checkWin(board, x, y)
    set({ board, lastMove: { x, y }, winner, turn: color === 'black' ? 'white' : 'black' })
  },
}))
