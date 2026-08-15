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

describe('bestMove 防守', () => {
  it('Lv1(浅搜索)也应封堵对方活三', () => {
    let b = emptyBoard()
    // 黑活三 (5,7)(6,7)(7,7)，两端 (4,7)(8,7) 空
    for (let x = 5; x <= 7; x++) b = applyMove(b, { x, y: 7, color: 'black' })
    const mv = bestMove(b, 'white', 1)
    const blocks = (mv.x === 4 && mv.y === 7) || (mv.x === 8 && mv.y === 7)
    expect(blocks).toBe(true)
  })
  it('Lv3 计时在合理范围内(<3.5s/步)', () => {
    let b = emptyBoard()
    for (const [x, y] of [[7, 7], [8, 8], [7, 8], [8, 7], [6, 6]] as const)
      b = applyMove(b, { x, y, color: (x + y) % 2 ? 'black' : 'white' })
    const t0 = performance.now()
    bestMove(b, 'white', 3)
    // 绝对耗时守护：给不同机器/负载留余量，仅拦截退化到秒级以上的异常慢。
    expect(performance.now() - t0).toBeLessThan(3500)
  })
})

describe('bestMove 进攻', () => {
  it('己方活三应主动扩成活四(而非消极防守)', () => {
    let b = emptyBoard()
    // 白活三 (6,7)(7,7)(8,7)，两端 (5,7)(9,7) 空；黑仅一枚远子，轮到白。
    for (let x = 6; x <= 8; x++) b = applyMove(b, { x, y: 7, color: 'white' })
    b = applyMove(b, { x: 0, y: 0, color: 'black' })
    const mv = bestMove(b, 'white', 2)
    const makesOpenFour = (mv.x === 5 && mv.y === 7) || (mv.x === 9 && mv.y === 7)
    expect(makesOpenFour).toBe(true)
  })
  it('应封堵对方“双三”落点(避免被双活三先手压制)', () => {
    let b = emptyBoard()
    // 黑若落 (7,7) 则同时形成横向(5,6,7)与纵向(7,5)(7,6)(7,7)两条活三 => 双三。
    for (const [x, y] of [[5, 7], [6, 7], [7, 5], [7, 6]] as const)
      b = applyMove(b, { x, y, color: 'black' })
    const mv = bestMove(b, 'white', 3)
    expect(mv.x === 7 && mv.y === 7).toBe(true)
  })
})
