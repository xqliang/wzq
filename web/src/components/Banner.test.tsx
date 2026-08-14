import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Banner } from './Banner'

describe('Banner', () => {
  it('渲染文案且带 tone 类', () => {
    const { container } = render(<Banner text="胜利" tone="gold" />)
    expect(screen.getByText('胜利')).toBeTruthy()
    expect(container.querySelector('.banner-gold')).toBeTruthy()
  })
})
