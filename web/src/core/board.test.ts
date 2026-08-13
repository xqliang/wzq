import { describe, it, expect } from 'vitest'
import { emptyBoard, SIZE } from './types'
import { isLegal, applyMove } from './board'
describe('board', () => {
  it('空点合法', () => { expect(isLegal(emptyBoard(), 7, 7)).toBe(true) })
  it('越界非法', () => {
    expect(isLegal(emptyBoard(), -1, 0)).toBe(false)
    expect(isLegal(emptyBoard(), SIZE, 0)).toBe(false)
  })
  it('已占非法', () => {
    const b = applyMove(emptyBoard(), { x: 7, y: 7, color: 'black' })
    expect(isLegal(b, 7, 7)).toBe(false)
  })
  it('applyMove 不改原棋盘', () => {
    const b0 = emptyBoard()
    const b1 = applyMove(b0, { x: 0, y: 0, color: 'black' })
    expect(b0[0][0]).toBeNull()
    expect(b1[0][0]).toBe('black')
  })
})
