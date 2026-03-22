import { describe, it, expect } from 'vitest'
import {
  createTokenSheet,
  LIGHT_TOKENS_CSS,
  DARK_TOKENS_CSS,
  lightTokenSheet,
  darkTokenSheet,
  mergeTokenSheets,
} from '../tokens/token-sheets.js'

describe('token-sheets', () => {
  describe('createTokenSheet', () => {
    it('returns a CSSStyleSheet instance', () => {
      const sheet = createTokenSheet(':root { --foo: red; }')
      expect(sheet).toBeInstanceOf(CSSStyleSheet)
    })

    it('populates rules from provided CSS', () => {
      const sheet = createTokenSheet(':root { --foo: red; } body { margin: 0; }')
      expect(sheet.cssRules.length).toBe(2)
    })
  })

  describe('LIGHT_TOKENS_CSS', () => {
    it('is a non-empty string containing --val-color-bg', () => {
      expect(typeof LIGHT_TOKENS_CSS).toBe('string')
      expect(LIGHT_TOKENS_CSS.length).toBeGreaterThan(0)
      expect(LIGHT_TOKENS_CSS).toContain('--val-color-bg')
    })

    it('uses :host selector for shadow DOM scoping', () => {
      expect(LIGHT_TOKENS_CSS).toMatch(/^:host/)
    })

    it('uses both :host and :root selectors', () => {
      expect(LIGHT_TOKENS_CSS).toMatch(/^:host,\s*:root\s*\{/)
    })
  })

  describe('DARK_TOKENS_CSS', () => {
    it('is a non-empty string containing --val-color-bg', () => {
      expect(typeof DARK_TOKENS_CSS).toBe('string')
      expect(DARK_TOKENS_CSS.length).toBeGreaterThan(0)
      expect(DARK_TOKENS_CSS).toContain('--val-color-bg')
    })

    it('uses :host selector for shadow DOM scoping', () => {
      expect(DARK_TOKENS_CSS).toMatch(/^:host/)
    })

    it('uses both :host and :root selectors', () => {
      expect(DARK_TOKENS_CSS).toMatch(/^:host,\s*:root\s*\{/)
    })
  })

  describe('singleton sheets', () => {
    it('lightTokenSheet and darkTokenSheet are distinct CSSStyleSheet singletons', () => {
      expect(lightTokenSheet).toBeInstanceOf(CSSStyleSheet)
      expect(darkTokenSheet).toBeInstanceOf(CSSStyleSheet)
      expect(lightTokenSheet).not.toBe(darkTokenSheet)
    })
  })

  describe('mergeTokenSheets', () => {
    it('returns a new sheet combining rules in cascade order', () => {
      const base = createTokenSheet(':root { --a: 1; }')
      const override = createTokenSheet(':root { --b: 2; }')
      const merged = mergeTokenSheets(base, override)

      expect(merged).toBeInstanceOf(CSSStyleSheet)
      expect(merged).not.toBe(base)
      expect(merged).not.toBe(override)
      expect(merged.cssRules.length).toBe(2)
    })
  })
})
