import { describe, it, expect } from 'vitest'
import { emptyBoard } from '../core/types'
import { applyMove } from '../core/board'
import { evaluate } from './evaluate'
describe('evaluate', () => {
  it('己方活四得分高于活三', () => {
    let four = emptyBoard()
    for (let x = 3; x <= 6; x++) four = applyMove(four, { x, y: 7, color: 'black' })
    let three = emptyBoard()
    for (let x = 3; x <= 5; x++) three = applyMove(three, { x, y: 7, color: 'black' })
    expect(evaluate(four, 'black')).toBeGreaterThan(evaluate(three, 'black'))
  })
  it('空盘评分为 0', () => {
    expect(evaluate(emptyBoard(), 'black')).toBe(0)
  })
})

import { bestMove } from './search'
describe('bestMove', () => {
  it('Lv3 必须堵对方冲四（否则下一手就输）', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 6; x++) b = applyMove(b, { x, y: 7, color: 'white' })
    const mv = bestMove(b, 'black', 3)
    const blocks = (mv.x === 2 && mv.y === 7) || (mv.x === 7 && mv.y === 7)
    expect(blocks).toBe(true)
  })
  it('Lv3 己方有连五机会必成五', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 6; x++) b = applyMove(b, { x, y: 5, color: 'black' })
    const mv = bestMove(b, 'black', 3)
    const wins = (mv.x === 2 && mv.y === 5) || (mv.x === 7 && mv.y === 5)
    expect(wins).toBe(true)
  })
  it('空盘返回中心附近', () => {
    const mv = bestMove(emptyBoard(), 'black', 1)
    expect(Math.abs(mv.x - 7)).toBeLessThanOrEqual(2)
    expect(Math.abs(mv.y - 7)).toBeLessThanOrEqual(2)
  })
})
