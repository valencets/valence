import { describe, it, expect } from 'vitest'
import { renderLayout } from '../admin/layout.js'

describe('headTags injection in admin layout', () => {
  const baseArgs = {
    title: 'Test',
    content: '<p>Content</p>',
    collections: []
  } as const

  it('renders without headTags when none provided', () => {
    const html = renderLayout(baseArgs)
    expect(html).toContain('<title>Test')
    expect(html).not.toContain('data-test-headtag')
  })

  it('injects headTags after title tag', () => {
    const html = renderLayout({
      ...baseArgs,
      headTags: ['<link rel="stylesheet" href="/custom.css">']
    })
    expect(html).toContain('<link rel="stylesheet" href="/custom.css">')
    // headTags should appear in <head>
    const headEnd = html.indexOf('</head>')
    const tagPos = html.indexOf('<link rel="stylesheet" href="/custom.css">')
    expect(tagPos).toBeLessThan(headEnd)
  })

  it('injects multiple headTags', () => {
    const html = renderLayout({
      ...baseArgs,
      headTags: [
        '<meta name="custom" content="value">',
        '<script src="/analytics.js" defer></script>'
      ]
    })
    expect(html).toContain('<meta name="custom" content="value">')
    expect(html).toContain('<script src="/analytics.js" defer></script>')
  })

  it('headTags appear after title and before style', () => {
    const html = renderLayout({
      ...baseArgs,
      headTags: ['<link rel="icon" href="/favicon.ico">']
    })
    const titleEnd = html.indexOf('</title>')
    const tagPos = html.indexOf('<link rel="icon" href="/favicon.ico">')
    const stylePos = html.indexOf('<style>')
    expect(tagPos).toBeGreaterThan(titleEnd)
    expect(tagPos).toBeLessThan(stylePos)
  })
})
