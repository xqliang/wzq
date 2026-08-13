export type Color = 'black' | 'white'
export type Cell = Color | null
export const SIZE = 15
export interface Move { x: number; y: number; color: Color }
export type Board = Cell[][]
export function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array<Cell>(SIZE).fill(null))
}
