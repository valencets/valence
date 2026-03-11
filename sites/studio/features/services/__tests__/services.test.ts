import { describe, it, expect } from 'vitest'
import { renderServices } from '../templates/services.js'
import { SERVICE_TIERS, OWNERSHIP_LIST } from '../config/services-content.js'

describe('renderServices', () => {
  it('returns non-empty HTML', () => {
    const html = renderServices()
    expect(html.length).toBeGreaterThan(0)
  })

  it('renders all three correct tier names', () => {
    const html = renderServices()
    expect(html).toContain('Build, Deploy &amp; Own')
    expect(html).toContain('The Infrastructure Pipe')
    expect(html).toContain('Managed Webmaster')
  })

  it('does NOT render Analytics & Conversion as a tier', () => {
    const html = renderServices()
    expect(html).not.toContain('Analytics &amp; Conversion')
    expect(html).not.toContain('Analytics & Conversion')
  })

  it('renders estimate ranges on each tier', () => {
    const html = renderServices()
    expect(html).toContain('~$3,500')
    expect(html).toContain('~$49')
    expect(html).toContain('~$199')
  })

  it('includes analytics features inside build-own tier, not a separate tier', () => {
    const html = renderServices()
    // Analytics features exist in the output
    expect(html).toContain('First-party analytics dashboard (HUD)')
    expect(html).toContain('Dynamic Number Insertion (DNI)')
    expect(html).toContain('Conversion funnel tracking')
    expect(html).toContain('Cookieless attribution')
    // They are inside the build-own tier card, not a separate analytics tier
    const buildOwnStart = html.indexOf('tier-build-own')
    const infrastructureStart = html.indexOf('tier-infrastructure')
    const hudPosition = html.indexOf('First-party analytics dashboard (HUD)')
    expect(buildOwnStart).toBeGreaterThan(-1)
    expect(infrastructureStart).toBeGreaterThan(-1)
    expect(hudPosition).toBeGreaterThan(buildOwnStart)
    expect(hudPosition).toBeLessThan(infrastructureStart)
  })

  it('renders ownership list with analytics line', () => {
    const html = renderServices()
    for (const item of OWNERSHIP_LIST) {
      expect(html).toContain(item)
    }
    expect(html).toContain('You own the analytics')
    expect(html).toContain('private dashboard')
  })

  it('has correct telemetry targets on tiers', () => {
    const html = renderServices()
    expect(html).toContain('data-telemetry-target="tier-build-own"')
    expect(html).toContain('data-telemetry-target="tier-infrastructure"')
    expect(html).toContain('data-telemetry-target="tier-managed"')
  })

  it('has CTA that says Request a Quote', () => {
    const html = renderServices()
    expect(html).toContain('services-contact-cta')
    expect(html).toContain('Request a Quote')
    expect(html).toContain('/about#contact')
  })

  it('uses internet doorway analogy, no hardware brand names', () => {
    const html = renderServices()
    expect(html).toContain('doorway')
    expect(html).not.toContain('Cloudflare')
    expect(html).not.toContain('Raspberry Pi')
    expect(html).not.toContain('ZimaBoard')
    expect(html).not.toContain('N100')
    expect(html).not.toContain('NVMe')
    expect(html).not.toContain('WD Red')
  })

  it('renders tier estimates with tier-estimate class', () => {
    const html = renderServices()
    expect(html).toContain('tier-estimate')
  })

  it('exports correct tier count from config', () => {
    expect(SERVICE_TIERS).toHaveLength(3)
    expect(SERVICE_TIERS[0].id).toBe('build-own')
    expect(SERVICE_TIERS[1].id).toBe('infrastructure')
    expect(SERVICE_TIERS[2].id).toBe('managed')
  })
})
