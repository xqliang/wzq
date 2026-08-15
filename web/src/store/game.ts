import { create } from 'zustand'
import { emptyBoard } from '../core/types'
import type { Board, Color } from '../core/types'
import { applyMove } from '../core/board'
import { checkWin, winningLine } from '../core/win'

// 一手落子记录（用于悔棋重建棋盘）。
interface Move {
  x: number
  y: number
  color: Color
}

// 对局状态：棋盘、当前轮次、我方执子、预落子、最近一手、胜方、历史与悔棋标记。
interface GameState {
  board: Board
  turn: Color
  myColor: Color
  pending: { x: number; y: number } | null
  lastMove: { x: number; y: number } | null
  winner: Color | null
  winLine: { x: number; y: number }[] | null
  history: Move[]
  undoMark: { x: number; y: number } | null // 悔棋位置标记（下一手落子后清除）
  reset: (myColor: Color) => void
  preview: (x: number, y: number) => void
  cancel: () => void
  confirm: () => void
  place: (x: number, y: number, color: Color) => void // 用于对手落子/回放
  undo: (n: number) => void // 悔棋：撤销最近 n 手，重建棋盘/回合，标记悔棋位置
  setup: (board: Board, toMove: Color) => void // 用于残局：注入预置局面并指定轮次
}

export const useGame = create<GameState>((set, get) => ({
  board: emptyBoard(),
  turn: 'black',
  myColor: 'black',
  pending: null,
  lastMove: null,
  winner: null,
  winLine: null,
  history: [],
  undoMark: null,
  // 重置整局，指定我方执子颜色（黑先）。
  reset: (myColor) =>
    set({
      board: emptyBoard(),
      turn: 'black',
      myColor,
      pending: null,
      lastMove: null,
      winner: null,
      winLine: null,
      history: [],
      undoMark: null,
    }),
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
  // 落子写盘：应用落子、判胜、记录最近一手/历史并切换轮次；清除悔棋标记。
  place: (x, y, color) => {
    const board = applyMove(get().board, { x, y, color })
    const winner = checkWin(board, x, y)
    set({
      board,
      lastMove: { x, y },
      winner,
      winLine: winner ? winningLine(board, x, y) : null,
      turn: color === 'black' ? 'white' : 'black',
      history: [...get().history, { x, y, color }],
      undoMark: null,
    })
  },
  // 悔棋：撤销最近 n 手，从历史重建棋盘；回合按剩余手数奇偶推定（黑先）；
  // 清空胜负；把被撤销最早的一手位置记为悔棋标记（下一手落子后由 place 清除）。
  undo: (n) => {
    const hist = get().history
    if (hist.length === 0 || n <= 0) return
    const keep = Math.max(0, hist.length - n)
    const remaining = hist.slice(0, keep)
    const removed = hist.slice(keep)
    let board = emptyBoard()
    for (const m of remaining) board = applyMove(board, m)
    const last = remaining.length ? remaining[remaining.length - 1] : null
    set({
      board,
      history: remaining,
      lastMove: last ? { x: last.x, y: last.y } : null,
      turn: remaining.length % 2 === 0 ? 'black' : 'white',
      winner: null,
      winLine: null,
      pending: null,
      undoMark: removed.length ? { x: removed[0].x, y: removed[0].y } : null,
    })
  },
  // 残局：直接注入预置棋盘并指定轮到谁走（我方=待解方），清空 pending/胜负/历史。
  setup: (board, toMove) =>
    set({
      board,
      turn: toMove,
      myColor: toMove,
      pending: null,
      lastMove: null,
      winner: null,
      winLine: null,
      history: [],
      undoMark: null,
    }),
}))
