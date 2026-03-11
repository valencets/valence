import { describe, it, expect } from 'vitest'
import { renderAbout } from '../templates/about.js'
import { ABOUT } from '../config/about-content.js'

describe('renderAbout', () => {
  it('returns non-empty HTML', () => {
    const html = renderAbout()
    expect(html.length).toBeGreaterThan(0)
  })

  it('contains headline', () => {
    const html = renderAbout()
    expect(html).toContain(ABOUT.headline)
  })

  it('contains founder name and bio', () => {
    const html = renderAbout()
    expect(html).toContain(ABOUT.founder.name)
    expect(html).toContain('Software engineer')
  })

  it('contains hardware section', () => {
    const html = renderAbout()
    expect(html).toContain(ABOUT.hardware.headline)
    expect(html).toContain('Raspberry Pi 5')
  })

  it('renders all hardware specs', () => {
    const html = renderAbout()
    for (const spec of ABOUT.hardware.specs) {
      expect(html).toContain(spec.label)
      expect(html).toContain(spec.value)
    }
  })

  it('has telemetry on hardware section', () => {
    const html = renderAbout()
    expect(html).toContain('data-telemetry-target="hardware-section"')
  })

  it('has contact CTA', () => {
    const html = renderAbout()
    expect(html).toContain('about-contact-cta')
    expect(html).toContain('/contact')
  })
})
