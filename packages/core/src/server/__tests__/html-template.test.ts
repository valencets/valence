import { describe, it, expect } from 'vitest'
import { html, renderLayout } from '../html-template.js'

describe('html tagged template', () => {
  it('returns a string', () => {
    const result = html`<p>hello</p>`
    expect(typeof result).toBe('string')
  })

  it('interpolates values', () => {
    const name = 'world'
    const result = html`<p>${name}</p>`
    expect(result).toBe('<p>world</p>')
  })

  it('escapes HTML entities in interpolated values', () => {
    const userInput = '<script>alert("xss")</script>'
    const result = html`<p>${userInput}</p>`
    expect(result).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>')
    expect(result).not.toContain('<script>')
  })

  it('escapes ampersands', () => {
    const result = html`<p>${'A & B'}</p>`
    expect(result).toContain('&amp;')
  })

  it('escapes single quotes', () => {
    const result = html`<p>${"it's"}</p>`
    expect(result).toContain('&#39;')
  })

  it('handles numbers without escaping', () => {
    const count = 42
    const result = html`<p>${count}</p>`
    expect(result).toBe('<p>42</p>')
  })

  it('handles null and undefined as empty string', () => {
    const result = html`<p>${null}${undefined}</p>`
    expect(result).toBe('<p></p>')
  })

  it('double-escapes nested html calls (safe by default)', () => {
    const inner = html`<strong>bold</strong>`
    const result = html`<div>${inner}</div>`
    expect(result).toContain('&lt;strong&gt;')
  })
})

describe('renderLayout', () => {
  it('returns a complete HTML document', () => {
    const result = renderLayout({
      title: 'Test Page',
      content: '<p>hello</p>'
    })
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<html')
    expect(result).toContain('</html>')
  })

  it('sets the title', () => {
    const result = renderLayout({ title: 'My Page', content: '' })
    expect(result).toContain('<title>My Page</title>')
  })

  it('injects content into main', () => {
    const result = renderLayout({ title: 'Test', content: '<p>body</p>' })
    expect(result).toContain('<main')
    expect(result).toContain('<p>body</p>')
  })

  it('includes head content when provided', () => {
    const result = renderLayout({
      title: 'Test',
      content: '',
      head: '<link rel="stylesheet" href="/styles.css">'
    })
    expect(result).toContain('<link rel="stylesheet" href="/styles.css">')
  })

  it('includes nav when provided', () => {
    const result = renderLayout({
      title: 'Test',
      content: '',
      nav: '<nav><a href="/">Home</a></nav>'
    })
    expect(result).toContain('<nav><a href="/">Home</a></nav>')
  })

  it('includes footer when provided', () => {
    const result = renderLayout({
      title: 'Test',
      content: '',
      footer: '<footer>2026</footer>'
    })
    expect(result).toContain('<footer>2026</footer>')
  })

  it('sets lang attribute', () => {
    const result = renderLayout({ title: 'Test', content: '', lang: 'es' })
    expect(result).toContain('lang="es"')
  })

  it('defaults lang to en', () => {
    const result = renderLayout({ title: 'Test', content: '' })
    expect(result).toContain('lang="en"')
  })

  it('supports fragment mode (no shell)', () => {
    const result = renderLayout({ title: 'Test', content: '<p>fragment</p>', fragment: true })
    expect(result).not.toContain('<!DOCTYPE html>')
    expect(result).toContain('<p>fragment</p>')
  })
})
