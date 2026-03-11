import { describe, it, expect } from 'vitest'
import { formatNumber } from '../data/format-number.js'

describe('formatNumber', () => {
  it('formats thousands with commas', () => {
    expect(formatNumber(1247)).toBe('1,247')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats millions', () => {
    expect(formatNumber(1000000)).toBe('1,000,000')
  })

  it('returns -- for NaN', () => {
    expect(formatNumber(NaN)).toBe('--')
  })

  it('returns -- for Infinity', () => {
    expect(formatNumber(Infinity)).toBe('--')
  })

  it('formats small numbers without commas', () => {
    expect(formatNumber(42)).toBe('42')
  })

  it('formats negative numbers', () => {
    expect(formatNumber(-500)).toBe('-500')
  })
})
