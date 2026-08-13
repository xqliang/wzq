import { describe, it, expect, beforeEach } from 'vitest'
import { useGame } from './game'

describe('game store', () => {
  beforeEach(() => useGame.getState().reset('black'))
  it('选点后进入预落子', () => {
    useGame.getState().preview(7, 7)
    expect(useGame.getState().pending).toEqual({ x: 7, y: 7 })
  })
  it('取消预落子', () => {
    useGame.getState().preview(7, 7)
    useGame.getState().cancel()
    expect(useGame.getState().pending).toBeNull()
  })
  it('确认落子写盘并切换', () => {
    useGame.getState().preview(7, 7)
    useGame.getState().confirm()
    expect(useGame.getState().board[7][7]).toBe('black')
    expect(useGame.getState().turn).toBe('white')
    expect(useGame.getState().pending).toBeNull()
  })
})
