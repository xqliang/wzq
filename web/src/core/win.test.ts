import { describe, it, expect } from 'vitest'
import { emptyBoard } from './types'
import { applyMove } from './board'
import { checkWin, winningLine } from './win'
describe('checkWin', () => {
  it('横向五连黑胜', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 7; x++) b = applyMove(b, { x, y: 7, color: 'black' })
    expect(checkWin(b, 7, 7)).toBe('black')
  })
  it('竖向五连', () => {
    let b = emptyBoard()
    for (let y = 0; y <= 4; y++) b = applyMove(b, { x: 5, y, color: 'white' })
    expect(checkWin(b, 5, 4)).toBe('white')
  })
  it('主对角线五连', () => {
    let b = emptyBoard()
    for (let i = 0; i <= 4; i++) b = applyMove(b, { x: i, y: i, color: 'black' })
    expect(checkWin(b, 4, 4)).toBe('black')
  })
  it('副对角线五连', () => {
    let b = emptyBoard()
    for (let i = 0; i <= 4; i++) b = applyMove(b, { x: i, y: 4 - i, color: 'black' })
    expect(checkWin(b, 4, 0)).toBe('black')
  })
  it('四连未胜', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 6; x++) b = applyMove(b, { x, y: 7, color: 'black' })
    expect(checkWin(b, 6, 7)).toBeNull()
  })
})

describe('winningLine', () => {
  it('横向返回 5 子（沿方向从负端到正端排序）', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 7; x++) b = applyMove(b, { x, y: 7, color: 'black' })
    expect(winningLine(b, 5, 7)).toEqual([
      { x: 3, y: 7 },
      { x: 4, y: 7 },
      { x: 5, y: 7 },
      { x: 6, y: 7 },
      { x: 7, y: 7 },
    ])
  })
  it('竖向返回 5 子', () => {
    let b = emptyBoard()
    for (let y = 0; y <= 4; y++) b = applyMove(b, { x: 5, y, color: 'white' })
    expect(winningLine(b, 5, 4)).toEqual([
      { x: 5, y: 0 },
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
      { x: 5, y: 4 },
    ])
  })
  it('主对角线返回 5 子', () => {
    let b = emptyBoard()
    for (let i = 0; i <= 4; i++) b = applyMove(b, { x: i, y: i, color: 'black' })
    expect(winningLine(b, 2, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ])
  })
  it('副对角线返回 5 子', () => {
    let b = emptyBoard()
    for (let i = 0; i <= 4; i++) b = applyMove(b, { x: i, y: 4 - i, color: 'black' })
    const line = winningLine(b, 2, 2)
    expect(line).not.toBeNull()
    expect(line!.length).toBe(5)
  })
  it('六连返回全部 6 子', () => {
    let b = emptyBoard()
    for (let x = 2; x <= 7; x++) b = applyMove(b, { x, y: 5, color: 'black' })
    expect(winningLine(b, 4, 5)!.length).toBe(6)
  })
  it('四连未胜返回 null', () => {
    let b = emptyBoard()
    for (let x = 3; x <= 6; x++) b = applyMove(b, { x, y: 7, color: 'black' })
    expect(winningLine(b, 6, 7)).toBeNull()
  })
  it('空点返回 null', () => {
    const b = emptyBoard()
    expect(winningLine(b, 7, 7)).toBeNull()
  })
})
