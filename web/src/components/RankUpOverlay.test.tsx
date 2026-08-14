import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RankUpOverlay } from './RankUpOverlay'

describe('RankUpOverlay', () => {
  it('显示旧->新段位并点击继续', () => {
    const onContinue = vi.fn()
    render(
      <RankUpOverlay fromLabel="业余2级" toLabel="业余3级" group="ji" coins={120} onContinue={onContinue} />,
    )
    expect(screen.getByText('业余2级')).toBeTruthy()
    expect(screen.getByText('业余3级')).toBeTruthy()
    fireEvent.click(screen.getByText('段位进阶'))
    expect(onContinue).toHaveBeenCalled()
  })
})
