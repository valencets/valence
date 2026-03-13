import { describe, it, expect } from 'vitest'
import { renderAuditForm } from '../templates/audit.js'
import { renderAuditResults } from '../templates/audit-results.js'
import type { LighthouseResult } from '../types/audit-types.js'

function makeResult (performance: number): LighthouseResult {
  return {
    url: 'https://example.com',
    scores: { performance, accessibility: 95, bestPractices: 90, seo: 85 },
    metrics: [],
    fetchedAt: '2026-03-12T00:00:00Z'
  }
}

describe('renderAuditForm', () => {
  it('has context sentence explaining what the audit measures', () => {
    const html = renderAuditForm()
    expect(html).toContain('industry standards')
  })
})

describe('renderAuditResults scores', () => {
  it('renders score values as plain HTML, not hud-metric custom elements', () => {
    const html = renderAuditResults(makeResult(95))
    expect(html).not.toContain('<hud-metric')
    expect(html).toContain('95')
    expect(html).toContain('Performance')
  })

  it('renders metric bars as plain HTML, not hud-bar custom elements', () => {
    const result: LighthouseResult = {
      url: 'https://example.com',
      scores: { performance: 90, accessibility: 95, bestPractices: 90, seo: 85 },
      metrics: [{ title: 'First Contentful Paint', displayValue: '1.2 s', numericValue: 1200 }],
      fetchedAt: '2026-03-12T00:00:00Z'
    }
    const html = renderAuditResults(result)
    expect(html).not.toContain('<hud-bar')
    expect(html).toContain('1.2 s')
  })

  it('applies green color for scores >= 90', () => {
    const html = renderAuditResults(makeResult(95))
    expect(html).toContain('hsl(142, 60%, 50%)')
  })
})

describe('renderAuditResults CTA', () => {
  it('shows consultation CTA after results', () => {
    const html = renderAuditResults(makeResult(95))
    expect(html).toContain('audit-cta')
    expect(html).toContain('/about#contact')
  })

  it('uses strong copy when performance < 90', () => {
    const html = renderAuditResults(makeResult(72))
    expect(html).toContain('leaving money on the table')
  })

  it('uses encouraging copy when performance >= 90', () => {
    const html = renderAuditResults(makeResult(95))
    expect(html).not.toContain('leaving money on the table')
    expect(html).toContain('score 100')
  })

  it('has telemetry on CTA link', () => {
    const html = renderAuditResults(makeResult(80))
    expect(html).toContain('data-telemetry-target="audit-results-cta"')
  })
})
