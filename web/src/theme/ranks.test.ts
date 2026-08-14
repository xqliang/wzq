import { describe, it, expect } from 'vitest'
import { rankLabel, rankGroup, RANK_COUNT } from './ranks'

describe('ranks 镜像', () => {
  it('19 阶总数', () => {
    expect(RANK_COUNT).toBe(19)
  })
  it('业余级：索引 0..8 -> 业余1级..业余9级', () => {
    expect(rankLabel(0)).toBe('业余1级')
    expect(rankLabel(8)).toBe('业余9级')
  })
  it('业余段：索引 9..17 -> 业余1段..业余9段', () => {
    expect(rankLabel(9)).toBe('业余1段')
    expect(rankLabel(17)).toBe('业余9段')
  })
  it('索引 18 -> 大师', () => {
    expect(rankLabel(18)).toBe('大师')
  })
  it('越界夹紧', () => {
    expect(rankLabel(-5)).toBe('业余1级')
    expect(rankLabel(999)).toBe('大师')
  })
  it('rankGroup 分档用于选奖章素材', () => {
    expect(rankGroup(0)).toBe('ji')
    expect(rankGroup(9)).toBe('duan')
    expect(rankGroup(18)).toBe('master')
  })
})
