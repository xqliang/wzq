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

  it('父组件频繁重渲染（onDone 引用变化）也能完成且只触发一次', () => {
    // 复刻人机模式回合倒计时每 250ms 触发的父组件重渲染：每次都传入新的 onDone 内联箭头。
    // 修复前 onDone 进 effect 依赖 → 每次重渲染清除并重设 1000ms 计时器 → n 冻结、onDone 永不触发。
    // 修复后 effect 依赖仅 [n] → 频繁重渲染不影响计时器 → 3s 后完成并只触发一次。
    const onDone = vi.fn()
    const { rerender } = render(<StartCountdown onDone={() => onDone()} />)
    // 每 250ms 重渲染一次（新引用），累计推进 4s（>3s 完成余量）。
    for (let i = 0; i < 16; i++) {
      act(() => { vi.advanceTimersByTime(250) })
      rerender(<StartCountdown onDone={() => onDone()} />)
    }
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
