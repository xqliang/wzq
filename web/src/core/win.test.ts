import { describe, it, expect } from 'vitest'
import { emptyBoard } from './types'
import { applyMove } from './board'
import { checkWin } from './win'
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
