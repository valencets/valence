import { describe, it, expect } from 'vitest'
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
