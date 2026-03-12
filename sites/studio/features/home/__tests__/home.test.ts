import { describe, it, expect } from 'vitest'
import { renderHome } from '../templates/home.js'
import { HERO, PILLARS, ELIMINATES, OWNERSHIP } from '../config/home-content.js'
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

  it('renders eliminate list', () => {
    const html = renderHome()
    for (const item of ELIMINATES) {
      expect(html).toContain(item)
    }
  })

  it('renders ownership section with proof metrics', () => {
    const html = renderHome()
    expect(html).toContain(OWNERSHIP.headline)
    for (const p of OWNERSHIP.proof) {
      expect(html).toContain(p.metric)
      expect(html).toContain(p.label)
    }
  })

  it('has bottom CTA', () => {
    const html = renderHome()
    expect(html).toContain('bottom-cta')
    expect(html).toContain('Contact Us')
  })

  it('does NOT link to /contact as a separate page', () => {
    const html = renderHome()
    expect(html).not.toContain('href="/contact"')
  })

  it('does NOT claim zero monthly costs when optional tiers exist', () => {
    expect(ELIMINATES).not.toContain('Monthly hosting invoices')
    expect(OWNERSHIP.body).not.toContain('No subscriptions')
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

  it('ownership proof labels match copy map defaults', () => {
    for (const p of OWNERSHIP.proof) {
      const match = HOME_COPY_MAP.find(e => e.default === p.label)
      expect(match).toBeDefined()
    }
  })
})
