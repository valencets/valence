import { describe, it, expect } from 'vitest'
import { formatDelta } from '../data/format-delta.js'

describe('formatDelta', () => {
  it('returns positive delta for growth', () => {
    const result = formatDelta(112, 100)
    expect(result.value).toBe('+12%')
    expect(result.direction).toBe('up')
  })

  it('returns negative delta for decline', () => {
    const result = formatDelta(90, 100)
    expect(result.value).toBe('-10%')
    expect(result.direction).toBe('down')
  })

  it('returns flat for zero change', () => {
    const result = formatDelta(100, 100)
    expect(result.value).toBe('0%')
    expect(result.direction).toBe('flat')
  })

  it('returns flat for both zero', () => {
    const result = formatDelta(0, 0)
    expect(result.value).toBe('0%')
    expect(result.direction).toBe('flat')
  })

  it('handles large positive delta', () => {
    const result = formatDelta(500, 100)
    expect(result.value).toBe('+400%')
    expect(result.direction).toBe('up')
  })

  it('handles previous zero with current non-zero', () => {
    const result = formatDelta(50, 0)
    expect(result.value).toBe('+100%')
    expect(result.direction).toBe('up')
  })

  it('rounds fractional percentages', () => {
    const result = formatDelta(103, 100)
    expect(result.value).toBe('+3%')
    expect(result.direction).toBe('up')
  })
})
