import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerBar } from './PlayerBar'

const p = (nickname: string, color: 'black' | 'white') => ({
  nickname, avatar: 'avatar_01', rankLabel: '业余2级', color,
})

describe('PlayerBar', () => {
  it('渲染双方昵称与段位，激活方高亮', () => {
    const { container } = render(
      <PlayerBar me={p('我', 'black')} opp={p('对手', 'white')} turn="black"
        timer={{ remain: 30, progress: 1, level: 'normal' }} />,
    )
    expect(screen.getByText('我')).toBeTruthy()
    expect(screen.getByText('对手')).toBeTruthy()
    expect(container.querySelectorAll('.player-rank').length).toBe(2)
    expect(container.querySelector('.player-side.left.active')).toBeTruthy()
  })
})
