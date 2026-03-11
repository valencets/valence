import { describe, it, expect } from 'vitest'
import { extractCriticalCSS } from '../index.js'
import { extractSelectors } from '../extract-selectors.js'
import { auditBudget } from '../budget-audit.js'

// Representative token CSS (subset of generateCSS output)
const TOKEN_CSS = `
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --radius-lg: var(--radius);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --font-sans: "Inter", sans-serif;
  --radius: 0.625rem;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
}

body {
  letter-spacing: var(--tracking-normal);
}

@layer base {
  * {
    border-color: var(--border);
  }
  body {
    background: var(--background);
    color: var(--foreground);
  }
}
`

// Utility classes that might appear in a full Tailwind build
const UTILITY_CSS = `
.flex { display: flex; }
.items-center { align-items: center; }
.gap-4 { gap: 1rem; }
.hidden { display: none; }
.text-xl { font-size: 1.25rem; }
.bg-primary { background-color: var(--primary); }
.p-8 { padding: 2rem; }
.grid { display: grid; }
.absolute { position: absolute; }
`

const FULL_CSS = TOKEN_CSS + UTILITY_CSS

const PAGE_HTML = `
<header id="top" class="flex items-center gap-4">
  <h1 class="text-xl">Hello</h1>
  <inertia-button class="bg-primary p-8">Click</inertia-button>
</header>
`

describe('integration: extractCriticalCSS', () => {
  it('full pipeline produces split result', () => {
    const result = extractCriticalCSS(FULL_CSS, PAGE_HTML)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.critical.length).toBeGreaterThan(0)
      expect(result.value.deferred.length).toBeGreaterThan(0)
    }
  })

  it('token CSS is entirely in critical split', () => {
    const result = extractCriticalCSS(FULL_CSS, PAGE_HTML)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.critical).toContain('@custom-variant')
      expect(result.value.critical).toContain('@theme')
      expect(result.value.critical).toContain(':root')
      expect(result.value.critical).toContain('.dark')
      expect(result.value.critical).toContain('body')
      expect(result.value.critical).toContain('@layer base')
    }
  })

  it('unused utility classes are in deferred split', () => {
    const result = extractCriticalCSS(FULL_CSS, PAGE_HTML)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.deferred).toContain('.hidden')
      expect(result.value.deferred).toContain('.grid')
      expect(result.value.deferred).toContain('.absolute')
    }
  })

  it('round-trip: critical + deferred reconstructs all rules', () => {
    const result = extractCriticalCSS(FULL_CSS, PAGE_HTML)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const combined = result.value.critical + result.value.deferred
      // All utility classes should appear in one split or the other
      expect(combined).toContain('.flex')
      expect(combined).toContain('.items-center')
      expect(combined).toContain('.gap-4')
      expect(combined).toContain('.hidden')
      expect(combined).toContain('.text-xl')
      expect(combined).toContain('.bg-primary')
      expect(combined).toContain('.p-8')
      expect(combined).toContain('.grid')
      expect(combined).toContain('.absolute')
    }
  })

  it('realistic page shell fits within 14kB', () => {
    const result = extractCriticalCSS(FULL_CSS, PAGE_HTML)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      const budget = auditBudget(PAGE_HTML, result.value.critical)
      expect(budget.isOk()).toBe(true)
      if (budget.isOk()) {
        expect(budget.value.withinBudget).toBe(true)
      }
    }
  })

  it('bloated page shell fails budget check', () => {
    // Generate selectors that force all utility CSS into critical
    const selectorResult = extractSelectors(PAGE_HTML)
    expect(selectorResult.isOk()).toBe(true)

    // Create enough CSS to exceed 14kB after gzip
    const bloatedClasses = Array.from({ length: 2000 }, (_, i) =>
      `.c${i}-${Math.random().toString(36).slice(2, 8)} { content: "${Math.random().toString(36).repeat(3)}"; }`
    )
    const bloatedCSS = TOKEN_CSS + bloatedClasses.join('\n')
    const bloatedHTML = '<div>' + Array.from({ length: 2000 }, (_, i) =>
      `<span class="c${i}-${Math.random().toString(36).slice(2, 8)}">x</span>`
    ).join('') + '</div>'

    // Even if splitting works, the raw content exceeds budget
    const budget = auditBudget(bloatedHTML, bloatedCSS)
    expect(budget.isOk()).toBe(true)
    if (budget.isOk()) {
      expect(budget.value.withinBudget).toBe(false)
    }
  })
})
