import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { StartCountdown } from './StartCountdown'

describe('StartCountdown', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('依次显示 3,2,1 后触发 onDone', () => {
    const onDone = vi.fn()
    render(<StartCountdown onDone={onDone} />)
    expect(screen.getByText('3')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText('2')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(screen.getByText('1')).toBeTruthy()
    act(() => { vi.advanceTimersByTime(1000) })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
