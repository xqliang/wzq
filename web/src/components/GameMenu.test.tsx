import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GameMenu } from './GameMenu'

describe('GameMenu', () => {
  it('点击菜单展开动作项，点动作触发回调并收起', () => {
    const onHint = vi.fn()
    render(
      <GameMenu
        actions={[{ label: '提示', onClick: onHint }]}
        onSettings={() => {}}
      />,
    )
    expect(screen.queryByText('提示')).toBeNull()
    fireEvent.click(screen.getByText('菜单'))
    fireEvent.click(screen.getByText('提示'))
    expect(onHint).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('提示')).toBeNull() // 点后收起
  })
})
