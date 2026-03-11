import { describe, it, expect } from 'vitest'
import { renderPrinciples } from '../templates/principles.js'
import { PRINCIPLES } from '../config/principles-content.js'

describe('renderPrinciples', () => {
  it('returns non-empty HTML', () => {
    const html = renderPrinciples()
    expect(html.length).toBeGreaterThan(0)
  })

  it('renders all four principles', () => {
    const html = renderPrinciples()
    for (const p of PRINCIPLES) {
      expect(html).toContain(p.title)
    }
  })

  it('has anchor IDs for each principle', () => {
    const html = renderPrinciples()
    for (const p of PRINCIPLES) {
      expect(html).toContain(`id="${p.id}"`)
    }
  })

  it('has principle navigation links', () => {
    const html = renderPrinciples()
    expect(html).toContain('Principles navigation')
    expect(html).toContain('href="#av-206"')
  })

  it('has telemetry attributes on sections', () => {
    const html = renderPrinciples()
    expect(html).toContain('data-telemetry-type="VIEWPORT_INTERSECT"')
  })

  it('has audit CTA at bottom', () => {
    const html = renderPrinciples()
    expect(html).toContain('Run a Free Audit')
    expect(html).toContain('/audit')
  })
})
