import { describe, it, expect } from 'vitest'
import { renderHome } from '../templates/home.js'
import { HERO, PILLARS, ELIMINATES, OWNERSHIP } from '../config/home-content.js'

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
})
