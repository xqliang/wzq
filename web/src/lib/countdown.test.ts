import { describe, it, expect } from 'vitest'
import { countdownState } from './countdown'

describe('countdownState', () => {
  it('剩余秒四舍五入到 0..total', () => {
    const now = 1_000_000
    expect(countdownState(now + 30_000, now, 30).remain).toBe(30)
    expect(countdownState(now + 4_400, now, 30).remain).toBe(4)
  })
  it('归零不为负', () => {
    const now = 1_000_000
    expect(countdownState(now - 5_000, now, 30).remain).toBe(0)
  })
  it('分级：>10 normal，(5,10] warn，(0,5] danger', () => {
    const now = 0
    expect(countdownState(20_000, now, 30).level).toBe('normal')
    expect(countdownState(8_000, now, 30).level).toBe('warn')
    expect(countdownState(3_000, now, 30).level).toBe('danger')
  })
  it('progress 为剩余比例 0..1', () => {
    const now = 0
    expect(countdownState(15_000, now, 30).progress).toBeCloseTo(0.5, 2)
  })
})
