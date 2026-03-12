import { describe, it, expect } from 'vitest'
import { classifyReferrer, aggregateByCategory } from '../data/classify-referrer.js'

describe('classifyReferrer', () => {
  it('maps google.com to Search', () => {
    expect(classifyReferrer('google.com')).toBe('Search')
  })

  it('maps bing.com to Search', () => {
    expect(classifyReferrer('bing.com')).toBe('Search')
  })

  it('maps duckduckgo.com to Search', () => {
    expect(classifyReferrer('duckduckgo.com')).toBe('Search')
  })

  it('maps empty string to Direct', () => {
    expect(classifyReferrer('')).toBe('Direct')
  })

  it('maps facebook.com to Social', () => {
    expect(classifyReferrer('facebook.com')).toBe('Social')
  })

  it('maps instagram.com to Social', () => {
    expect(classifyReferrer('instagram.com')).toBe('Social')
  })

  it('maps x.com to Social', () => {
    expect(classifyReferrer('x.com')).toBe('Social')
  })

  it('maps nextdoor.com to Social', () => {
    expect(classifyReferrer('nextdoor.com')).toBe('Social')
  })

  it('maps yelp.com to Referral', () => {
    expect(classifyReferrer('yelp.com')).toBe('Referral')
  })

  it('maps bbb.org to Referral', () => {
    expect(classifyReferrer('bbb.org')).toBe('Referral')
  })

  it('maps unknown domain to Other', () => {
    expect(classifyReferrer('randomsite.xyz')).toBe('Other')
  })

  it('is case-insensitive', () => {
    expect(classifyReferrer('Google.com')).toBe('Search')
    expect(classifyReferrer('FACEBOOK.COM')).toBe('Social')
  })

  it('handles www prefix', () => {
    expect(classifyReferrer('www.google.com')).toBe('Search')
  })

  it('handles full URLs', () => {
    expect(classifyReferrer('https://www.google.com/search?q=test')).toBe('Search')
  })

  it('returns Direct for undefined input (JSONB gap)', () => {
    expect(classifyReferrer(undefined as unknown as string)).toBe('Direct')
  })

  it('returns Direct for null input (JSONB gap)', () => {
    expect(classifyReferrer(null as unknown as string)).toBe('Direct')
  })
})

describe('aggregateByCategory', () => {
  it('groups sources by category and sums counts', () => {
    const sources = [
      { referrer: 'google.com', count: 50 },
      { referrer: 'bing.com', count: 10 },
      { referrer: '', count: 30 },
      { referrer: 'facebook.com', count: 10 }
    ]
    const result = aggregateByCategory(sources)
    const search = result.find(r => r.category === 'Search')
    expect(search?.count).toBe(60)
    expect(search?.percent).toBe(60)
  })

  it('returns empty array for empty sources', () => {
    expect(aggregateByCategory([])).toEqual([])
  })

  it('sorts by count descending', () => {
    const sources = [
      { referrer: 'facebook.com', count: 5 },
      { referrer: 'google.com', count: 50 },
      { referrer: '', count: 30 }
    ]
    const result = aggregateByCategory(sources)
    expect(result[0]?.category).toBe('Search')
    expect(result[1]?.category).toBe('Direct')
  })

  it('computes rounded percentages', () => {
    const sources = [
      { referrer: 'google.com', count: 1 },
      { referrer: '', count: 2 }
    ]
    const result = aggregateByCategory(sources)
    const search = result.find(r => r.category === 'Search')
    expect(search?.percent).toBe(33)
  })
})
