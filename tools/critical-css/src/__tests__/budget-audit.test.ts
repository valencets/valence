import { describe, it, expect } from 'vitest'
import { auditBudget, BUDGET_BYTES, DEFAULT_HEADER_ESTIMATE } from '../budget-audit.js'

describe('auditBudget', () => {
  it('small content is within budget', () => {
    const result = auditBudget('<div>hello</div>', 'body { color: red; }')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.withinBudget).toBe(true)
    }
  })

  it('large bloated content exceeds budget', () => {
    // Generate high-entropy content that gzip cannot compress below 14kB
    const classes = Array.from({ length: 3000 }, (_, i) => `.cls-${i}-${Math.random().toString(36).slice(2, 8)}`)
    const bigCSS = classes.map((c) => `${c} { padding: ${Math.random()}px; }`).join('\n')
    const bigHTML = '<div>' + classes.map((c) => `<span class="${c.slice(1)}">x</span>`).join('') + '</div>'
    const result = auditBudget(bigHTML, bigCSS)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.withinBudget).toBe(false)
    }
  })

  it('utilization percentage is calculated correctly', () => {
    const result = auditBudget('<div>hello</div>', 'body { color: red; }')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const expected = ((result.value.compressedBytes + result.value.headerEstimate) / result.value.budgetBytes) * 100
      expect(result.value.utilizationPercent).toBeCloseTo(expected, 2)
    }
  })

  it('custom header estimate is respected', () => {
    const result = auditBudget('<div>hi</div>', 'body {}', 800)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.headerEstimate).toBe(800)
    }
  })

  it('default header estimate is 500', () => {
    expect(DEFAULT_HEADER_ESTIMATE).toBe(500)
    const result = auditBudget('<div>hi</div>', 'body {}')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.headerEstimate).toBe(500)
    }
  })

  it('budget constant is 14336', () => {
    expect(BUDGET_BYTES).toBe(14_336)
  })

  it('compressed bytes are less than total bytes', () => {
    const html = '<div class="flex items-center gap-4 p-8">' + '<p>content</p>'.repeat(50) + '</div>'
    const css = '.flex { display: flex; } .items-center { align-items: center; }'
    const result = auditBudget(html, css)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.compressedBytes).toBeLessThan(result.value.totalBytes)
    }
  })

  it('empty HTML shell returns valid report', () => {
    const result = auditBudget('', 'body { color: red; }')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.totalBytes).toBeGreaterThan(0)
      expect(result.value.compressedBytes).toBeGreaterThan(0)
      expect(result.value.budgetBytes).toBe(BUDGET_BYTES)
    }
  })

  it('reports include all fields with correct types', () => {
    const result = auditBudget('<div>test</div>', 'body { margin: 0; }')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const report = result.value
      expect(typeof report.totalBytes).toBe('number')
      expect(typeof report.compressedBytes).toBe('number')
      expect(typeof report.budgetBytes).toBe('number')
      expect(typeof report.headerEstimate).toBe('number')
      expect(typeof report.withinBudget).toBe('boolean')
      expect(typeof report.utilizationPercent).toBe('number')
    }
  })
})
