import { describe, it, expect } from 'vitest'
import { renderServices } from '../templates/services.js'
import { SERVICE_TIERS, OWNERSHIP_LIST } from '../config/services-content.js'
import { SERVICES_COPY_MAP } from '../config/services-copy-map.js'

describe('renderServices', () => {
  it('returns non-empty HTML', () => {
    const html = renderServices()
    expect(html.length).toBeGreaterThan(0)
  })

  it('renders all three correct tier names', () => {
    const html = renderServices()
    expect(html).toContain('Build, Deploy & Own')
    expect(html).toContain('The Infrastructure Pipe')
    expect(html).toContain('Managed Webmaster')
  })

  it('does NOT render Analytics & Conversion as a tier', () => {
    const html = renderServices()
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

  it('uses internet doorway analogy, no hardware brand names in visible copy', () => {
    const html = renderServices()
    // Strip data-copy-technical attributes (technical copy is hidden by default)
    const visible = html.replace(/\s*data-copy-technical="[^"]*"/g, '')
    expect(visible).toContain('doorway')
    expect(visible).not.toContain('Cloudflare')
    expect(visible).not.toContain('Raspberry Pi')
    expect(visible).not.toContain('ZimaBoard')
    expect(visible).not.toContain('N100')
    expect(visible).not.toContain('NVMe')
    expect(visible).not.toContain('WD Red')
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

  it('renders data-copy-technical attributes for dual-layer copy', () => {
    const html = renderServices()
    expect(html).toContain('data-copy-technical=')
    expect(html).toContain('data-copy-default=')
  })

  it('swappable tier includes match copy map defaults', () => {
    const allIncludes = SERVICE_TIERS.flatMap(t => t.includes)
    for (const entry of SERVICES_COPY_MAP) {
      expect(allIncludes).toContain(entry.default)
    }
  })
})
