import { describe, it, expect } from 'vitest'
import { renderHome } from '../templates/home.js'
import { HERO, PILLARS } from '../config/home-content.js'
import { HOME_COPY_MAP } from '../config/home-copy-map.js'

describe('renderHome', () => {
  it('returns non-empty HTML', () => {
    const html = renderHome()
    expect(html.length).toBeGreaterThan(0)
  })

  it('contains hero headline', () => {
    const html = renderHome()
    expect(html).toContain(HERO.headline)
  })

  it('contains hero CTAs with telemetry attributes', () => {
    const html = renderHome()
    expect(html).toContain('data-telemetry-type="INTENT_NAVIGATE"')
    expect(html).toContain('hero-cta-primary')
    expect(html).toContain('hero-cta-secondary')
  })

  it('renders all four pillar cards', () => {
    const html = renderHome()
    for (const pillar of PILLARS) {
      expect(html).toContain(pillar.title)
    }
  })

  it('has bottom CTA', () => {
    const html = renderHome()
    expect(html).toContain('bottom-cta')
    expect(html).toContain('Run Free Site Audit')
    expect(html).toContain('href="/free-site-audit"')
  })

  it('does NOT link to /contact as a separate page', () => {
    const html = renderHome()
    expect(html).not.toContain('href="/contact"')
  })

  it('does NOT reference hardware brand names in public-facing copy', () => {
    const html = renderHome()
    expect(html).not.toContain(' Pi,')
    expect(html).not.toContain(' Pi.')
    expect(html).not.toContain('Raspberry')
    expect(html).not.toContain('ZimaBoard')
    expect(html).not.toContain('N100')
  })

  it('renders data-copy-technical attributes for dual-layer copy', () => {
    const html = renderHome()
    expect(html).toContain('data-copy-technical=')
    expect(html).toContain('data-copy-default=')
  })

  it('hero text matches copy map default', () => {
    const heroEntry = HOME_COPY_MAP.find(e => e.id === 'hero-headline')
    expect(HERO.headline).toBe(heroEntry?.default)
  })

  it('pillar titles match copy map defaults', () => {
    const pillarTitleEntries = HOME_COPY_MAP.filter(e => e.id.startsWith('pillar-') && e.id.endsWith('-title'))
    expect(pillarTitleEntries.length).toBe(PILLARS.length)
  })
})

describe('renderHome pillar copy rewrite', () => {
  it('pillar titles use plain-language business outcomes', () => {
    expect(PILLARS[0].title).toBe('Never Stutters Under Load')
    expect(PILLARS[1].title).toBe('Never Crashes Silently')
    expect(PILLARS[2].title).toBe('Nothing Can Hide in the Code')
    expect(PILLARS[3].title).toBe('Loads Before Your Competitor\'s Logo Appears')
  })

  it('pillar titles do not contain engineering jargon', () => {
    for (const pillar of PILLARS) {
      expect(pillar.title).not.toContain('Dynamic Allocation')
      expect(pillar.title).not.toContain('Exceptions')
      expect(pillar.title).not.toContain('Complexity')
      expect(pillar.title).not.toContain('First Paint')
    }
  })
})

describe('renderHome hero eyebrow + stats', () => {
  it('contains hero eyebrow with McKinney text', () => {
    const html = renderHome()
    expect(html).toContain('hero-eyebrow')
    expect(html).toContain('McKinney')
  })

  it('contains hero pulse dot in eyebrow', () => {
    const html = renderHome()
    expect(html).toContain('hero-pulse')
  })

  it('contains em accent inside h1', () => {
    const html = renderHome()
    const h1Match = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/)
    expect(h1Match).not.toBeNull()
    expect(h1Match![0]).toContain('<em>')
  })

  it('contains hero stats bar with 4 stat cells', () => {
    const html = renderHome()
    expect(html).toContain('hero-stats')
    const statCount = (html.match(/hero-stat"/g) || []).length
    expect(statCount).toBe(4)
  })

  it('contains expected stat values', () => {
    const html = renderHome()
    expect(html).toContain('&lt;1s')
    expect(html).toContain('100')
    expect(html).toContain('>0<')
    expect(html).toContain('100%')
  })
})

describe('renderHome comparison section', () => {
  it('contains comparison section before pillars', () => {
    const html = renderHome()
    const comparisonPos = html.indexOf('comparison-section')
    const pillarPos = html.indexOf('pillars-section')
    expect(comparisonPos).toBeGreaterThan(-1)
    expect(pillarPos).toBeGreaterThan(-1)
    expect(comparisonPos).toBeLessThan(pillarPos)
  })

  it('contains comparison table with 4 column headers', () => {
    const html = renderHome()
    expect(html).toContain('comparison-table')
    const thMatches = html.match(/<th[^>]*>/g) || []
    expect(thMatches.length).toBe(4)
  })

  it('Inertia column header has accent class', () => {
    const html = renderHome()
    expect(html).toContain('comparison-accent')
  })

  it('comparison table has 8 data rows', () => {
    const html = renderHome()
    const tableMatch = html.match(/<tbody[\s\S]*?<\/tbody>/)
    expect(tableMatch).not.toBeNull()
    const rowCount = (tableMatch![0].match(/<tr/g) || []).length
    expect(rowCount).toBe(8)
  })

  it('uses marker classes not inline color styles', () => {
    const html = renderHome()
    expect(html).toContain('marker-pass')
    expect(html).toContain('marker-fail')
    expect(html).toContain('marker-partial')
    // No inline color on markers
    expect(html).not.toMatch(/marker-(?:pass|fail|partial)[^"]*style=/)
  })
})

describe('renderHome pain cards', () => {
  it('renders 4 pain cards', () => {
    const html = renderHome()
    const cardCount = (html.match(/pain-card"/g) || html.match(/pain-card /g) || []).length
    expect(cardCount).toBe(4)
  })

  it('renders 3 pain variant and 1 ours variant', () => {
    const html = renderHome()
    const painCount = (html.match(/pain-card-pain/g) || []).length
    const oursCount = (html.match(/pain-card-ours/g) || []).length
    expect(painCount).toBe(3)
    expect(oursCount).toBe(1)
  })

  it('each pain card has label, title, description, and stat', () => {
    const html = renderHome()
    const cardMatches = html.match(/class="pain-card[\s\S]*?(?=class="pain-card|<\/div>\s*<\/div>\s*<div class="comparison-cta)/g)
    expect(cardMatches).not.toBeNull()
    for (const card of cardMatches!) {
      expect(card).toContain('pain-label')
      expect(card).toContain('<h3')
      expect(card).toContain('<p')
      expect(card).toContain('pain-stat')
    }
  })
})

describe('renderHome comparison CTA', () => {
  it('renders comparison CTA with audit link', () => {
    const html = renderHome()
    expect(html).toContain('comparison-cta')
    expect(html).toContain('Run Free Site Audit')
    expect(html).toContain('data-telemetry-target="comparison-cta"')
  })
})

describe('renderHome hero (halftone moved to shell)', () => {
  it('hero does NOT contain inline halftone SVG (now in shell)', () => {
    const html = renderHome()
    expect(html).not.toContain('hero-halftone')
    expect(html).not.toContain('site-halftone')
  })

  it('hero still wraps content in hero-content div', () => {
    const html = renderHome()
    expect(html).toContain('hero-content')
  })
})
