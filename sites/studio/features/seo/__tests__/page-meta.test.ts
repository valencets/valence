import { describe, it, expect } from 'vitest'
import { PAGE_META } from '../config/page-meta.js'

const MAX_DESCRIPTION_LENGTH = 155

describe('PAGE_META', () => {
  it('has meta for all five public pages with new route keys', () => {
    expect(PAGE_META).toHaveProperty('home')
    expect(PAGE_META).toHaveProperty('how-it-works')
    expect(PAGE_META).toHaveProperty('pricing')
    expect(PAGE_META).toHaveProperty('free-site-audit')
    expect(PAGE_META).toHaveProperty('about')
  })

  it('every description is under 155 characters', () => {
    for (const [page, meta] of Object.entries(PAGE_META)) {
      expect(meta.description.length, `${page} description too long (${meta.description.length} chars)`).toBeLessThanOrEqual(MAX_DESCRIPTION_LENGTH)
    }
  })

  it('every description is non-empty', () => {
    for (const [, meta] of Object.entries(PAGE_META)) {
      expect(meta.description.length).toBeGreaterThan(0)
    }
  })

  it('home description mentions McKinney TX', () => {
    expect(PAGE_META.home.description).toContain('McKinney')
  })

  it('about description mentions solo web studio', () => {
    expect(PAGE_META.about.description).toContain('solo web studio')
  })

  it('audit description mentions free', () => {
    expect(PAGE_META.audit.description.toLowerCase()).toContain('free')
  })

  it('no description references specific hardware brands', () => {
    for (const [, meta] of Object.entries(PAGE_META)) {
      expect(meta.description).not.toContain('Raspberry')
      expect(meta.description).not.toContain('N100')
      expect(meta.description).not.toContain('ZimaBoard')
    }
  })
})
