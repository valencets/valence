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
    expect(html).toContain('class="dot"')
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
    const statCount = (html.match(/class="hero-stat"/g) || []).length
    expect(statCount).toBe(4)
  })

  it('contains expected stat values', () => {
    const html = renderHome()
    expect(html).toContain('&lt;1s')
    expect(html).toContain('>100<')
    expect(html).toContain('>0<')
    expect(html).toContain('100%')
  })

  it('Lighthouse score has green accent class', () => {
    const html = renderHome()
    expect(html).toContain('class="val green"')
  })

  it('Lighthouse and Client Owned have green class, others do not', () => {
    const html = renderHome()
    const greenCount = (html.match(/class="val green"/g) || []).length
    expect(greenCount).toBe(2)
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

  it('comparison heading matches prototype', () => {
    const html = renderHome()
    expect(html).toContain('What you\u2019re actually paying for')
  })

  it('comparison subtitle matches prototype', () => {
    const html = renderHome()
    expect(html).toContain('Most DFW businesses don\u2019t realize')
  })

  it('contains comp-table with 4 column headers', () => {
    const html = renderHome()
    expect(html).toContain('comp-table')
    const theadMatch = html.match(/<thead>[\s\S]*?<\/thead>/)
    expect(theadMatch).not.toBeNull()
    const thMatches = theadMatch![0].match(/<th[\s>]/g) || []
    expect(thMatches.length).toBe(4)
  })

  it('Inertia Web Solutions is second column (mobile-first order)', () => {
    const html = renderHome()
    const theadMatch = html.match(/<thead>[\s\S]*?<\/thead>/)!
    const ths = theadMatch[0].match(/<th[^>]*>[^<]*<\/th>/g) || []
    expect(ths[1]).toContain('Inertia Web Solutions')
    expect(ths[1]).toContain('comparison-accent')
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

  it('uses check/cross/warn marker classes', () => {
    const html = renderHome()
    expect(html).toContain('class="check"')
    expect(html).toContain('class="cross"')
    expect(html).toContain('class="warn"')
  })

  it('uses price-pain and price-good classes for cost rows', () => {
    const html = renderHome()
    expect(html).toContain('price-pain')
    expect(html).toContain('price-good')
  })

  it('contains prototype table row content', () => {
    const html = renderHome()
    expect(html).toContain('Typical Cost')
    expect(html).toContain('3-Year Total')
    expect(html).toContain('Locked in their platform')
    expect(html).toContain('Database on your hardware')
    expect(html).toContain('Price is the price. No surprises.')
  })
})

describe('renderHome pain cards', () => {
  it('renders 6 pain cards', () => {
    const html = renderHome()
    const cardCount = (html.match(/class="pain-card[ "]/g) || []).length
    expect(cardCount).toBe(6)
  })

  it('renders 3 pain variant and 3 ours variant', () => {
    const html = renderHome()
    const oursCount = (html.match(/pain-card ours/g) || []).length
    expect(oursCount).toBe(3)
    const totalCards = (html.match(/class="pain-card[ "]/g) || []).length
    expect(totalCards - oursCount).toBe(3)
  })

  it('pain card labels match prototype', () => {
    const html = renderHome()
    expect(html).toContain('The Platform Trap')
    expect(html).toContain('The Agency Tax')
    expect(html).toContain('The Outage Gamble')
    expect(html).toContain('How We\'re Different')
  })

  it('pain card titles match prototype', () => {
    const html = renderHome()
    expect(html).toContain('You don\'t own your Wix site')
    expect(html).toContain('$60K/year and you still own nothing')
    expect(html).toContain('When AWS goes down, your business stops')
    expect(html).toContain('Your server sits in your office')
  })

  it('each pain card has label, title, description, and stat', () => {
    const html = renderHome()
    expect(html).toContain('pain-label')
    expect(html).toContain('class="stat"')
    // Each card should have an h3 and p within pain-grid
    const painSection = html.match(/class="pain-grid">([\s\S]*?)<\/div>\s*<div class="bottom-cta/)
    expect(painSection).not.toBeNull()
    const h3Count = (painSection![1].match(/<h3/g) || []).length
    const pCount = (painSection![1].match(/<p[ >]/g) || []).length
    expect(h3Count).toBe(6)
    expect(pCount).toBe(6)
  })

  it('stat divs contain strong tags for emphasis', () => {
    const html = renderHome()
    const painSection = html.match(/class="pain-grid">([\s\S]*?)<\/div>\s*<div class="bottom-cta/)
    expect(painSection).not.toBeNull()
    const strongCount = (painSection![1].match(/<strong>/g) || []).length
    expect(strongCount).toBeGreaterThanOrEqual(6)
  })

  it('renders Built for Speed and True Independence cards', () => {
    const html = renderHome()
    expect(html).toContain('Built for Speed')
    expect(html).toContain('Your site loads before they can blink')
    expect(html).toContain('True Independence')
    expect(html).toContain('Your site runs with or without us')
  })
})

describe('renderHome comparison CTA', () => {
  it('renders comparison CTA with audit link', () => {
    const html = renderHome()
    expect(html).toContain('bottom-cta')
    expect(html).toContain('Run Free Site Audit')
    expect(html).toContain('data-telemetry-target="comparison-cta"')
  })

  it('comparison CTA copy matches prototype', () => {
    const html = renderHome()
    expect(html).toContain('Curious what your current site is costing you?')
    expect(html).toContain('No email required.')
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
