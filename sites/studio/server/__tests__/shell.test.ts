import { describe, it, expect } from 'vitest'
import { renderShell, renderFragment } from '../shell.js'

const defaultOptions = {
  title: 'Test',
  description: 'Test description',
  criticalCSS: 'body{margin:0}',
  deferredCSSPath: '/css/studio.css',
  mainContent: '<h1>Hello</h1>',
  currentPath: '/'
}

describe('renderShell', () => {
  it('returns a complete HTML document', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('includes the title', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('<title>Test | Inertia Web Solutions</title>')
  })

  it('includes critical CSS inline', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('<style>body{margin:0}</style>')
  })

  it('loads deferred CSS without inline event handlers (CSP-safe)', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('/css/studio.css')
    // Must NOT use onload inline handler — blocked by script-src 'self' CSP
    expect(html).not.toContain('onload=')
    expect(html).not.toContain('media="print"')
  })

  it('appends cache-busting query param to CSS path', () => {
    const html = renderShell(defaultOptions)
    // CSS link should have ?v= param to bust browser cache on content change
    expect(html).toMatch(/\/css\/studio\.css\?v=/)
  })

  it('includes main content', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('<main id="main-content">')
    expect(html).toContain('<h1>Hello</h1>')
  })

  it('includes navigation with 6 links', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('aria-label="Main navigation"')
    const navLinks = html.match(/data-telemetry-type="INTENT_NAVIGATE"/g)
    expect(navLinks).toHaveLength(6)
  })

  it('marks current page as active', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('aria-current="page"')
  })

  it('includes footer with hardware message', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('Raspberry Pi 5')
  })

  it('includes favicon link', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg">')
  })

  it('includes mark SVG in nav brand', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('mark-light.svg')
    expect(html).toContain('class="nav-mark"')
  })

  it('has uppercase INERTIA brand text', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('INERTIA')
  })

  it('uses dark class on html element', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('class="dark"')
  })

  it('includes meta description', () => {
    const html = renderShell(defaultOptions)
    expect(html).toContain('content="Test description"')
  })
})

describe('renderFragment', () => {
  it('returns just the main content', () => {
    const fragment = renderFragment('<h1>Hello</h1>')
    expect(fragment).toBe('<h1>Hello</h1>')
    expect(fragment).not.toContain('<!DOCTYPE')
  })
})
