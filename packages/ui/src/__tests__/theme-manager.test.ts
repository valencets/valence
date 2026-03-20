import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ThemeMode, themeManager } from '../tokens/theme-manager.js'
import { lightTokenSheet, darkTokenSheet } from '../tokens/token-sheets.js'

describe('theme-manager', () => {
  beforeEach(() => {
    themeManager._reset()
  })

  afterEach(() => {
    themeManager._reset()
  })

  describe('ThemeMode', () => {
    it('Light equals "light"', () => {
      expect(ThemeMode.Light).toBe('light')
    })

    it('Dark equals "dark"', () => {
      expect(ThemeMode.Dark).toBe('dark')
    })

    it('System equals "system"', () => {
      expect(ThemeMode.System).toBe('system')
    })
  })

  describe('resolveTheme', () => {
    it('returns "light" by default', () => {
      expect(themeManager.resolveTheme()).toBe('light')
    })
  })

  describe('setTheme / getActiveSheet', () => {
    it('setTheme("dark") causes getActiveSheet to return darkTokenSheet', () => {
      themeManager.setTheme(ThemeMode.Dark)
      expect(themeManager.getActiveSheet()).toBe(darkTokenSheet)
    })

    it('setTheme("light") causes getActiveSheet to return lightTokenSheet', () => {
      themeManager.setTheme(ThemeMode.Dark)
      themeManager.setTheme(ThemeMode.Light)
      expect(themeManager.getActiveSheet()).toBe(lightTokenSheet)
    })
  })

  describe('subscribe / unsubscribe', () => {
    function createShadowRoot (): ShadowRoot {
      const el = document.createElement('div')
      document.body.appendChild(el)
      return el.attachShadow({ mode: 'open' })
    }

    it('subscribe adds active sheet to shadowRoot.adoptedStyleSheets', () => {
      const root = createShadowRoot()
      themeManager.subscribe(root)
      expect(root.adoptedStyleSheets).toContain(themeManager.getActiveSheet())
    })

    it('after subscribing, setTheme updates subscribed shadow root adoptedStyleSheets', () => {
      const root = createShadowRoot()
      themeManager.subscribe(root)
      themeManager.setTheme(ThemeMode.Dark)
      expect(root.adoptedStyleSheets).toContain(darkTokenSheet)
    })

    it('unsubscribe removes token sheet from adoptedStyleSheets', () => {
      const root = createShadowRoot()
      themeManager.subscribe(root)
      themeManager.unsubscribe(root)
      expect(root.adoptedStyleSheets).not.toContain(lightTokenSheet)
      expect(root.adoptedStyleSheets).not.toContain(darkTokenSheet)
    })
  })

  describe('val:theme-change event', () => {
    it('setTheme dispatches val:theme-change event on document', () => {
      let received: { mode: string, resolved: string } | null = null
      const handler = (e: Event): void => {
        received = (e as CustomEvent).detail
      }
      document.addEventListener('val:theme-change', handler)
      themeManager.setTheme(ThemeMode.Dark)
      document.removeEventListener('val:theme-change', handler)
      expect(received).not.toBeNull()
      expect(received!.mode).toBe('dark')
      expect(received!.resolved).toBe('dark')
    })
  })

  describe('system preference auto-switch', () => {
    let mockMql: { matches: boolean, listeners: Array<(e: MediaQueryListEvent) => void> }
    let originalMatchMedia: typeof globalThis.matchMedia

    beforeEach(() => {
      originalMatchMedia = globalThis.matchMedia
      mockMql = { matches: false, listeners: [] }
      globalThis.matchMedia = (query: string) => ({
        matches: mockMql.matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: (_: string, handler: EventListenerOrEventListenerObject) => {
          mockMql.listeners.push(handler as (e: MediaQueryListEvent) => void)
        },
        removeEventListener: (_: string, handler: EventListenerOrEventListenerObject) => {
          mockMql.listeners = mockMql.listeners.filter(h => h !== handler)
        },
        dispatchEvent: () => false,
      }) as MediaQueryList
      themeManager._reset()
    })

    afterEach(() => {
      themeManager._reset()
      globalThis.matchMedia = originalMatchMedia
    })

    it('system preference change auto-switches when mode is "system"', () => {
      themeManager.setTheme(ThemeMode.System)

      mockMql.matches = true
      for (const listener of mockMql.listeners) {
        listener({ matches: true } as MediaQueryListEvent)
      }

      expect(themeManager.getActiveSheet()).toBe(darkTokenSheet)
    })
  })

  describe('applyOverrides / clearOverrides', () => {
    it('applyOverrides merges override into active sheet', () => {
      const override = new CSSStyleSheet()
      override.replaceSync(':root { --val-color-bg: red; }')
      themeManager.applyOverrides(override)
      const sheet = themeManager.getActiveSheet()
      // Should be a merged sheet, not the original singleton
      expect(sheet).not.toBe(lightTokenSheet)
      expect(sheet).not.toBe(darkTokenSheet)
    })

    it('clearOverrides reverts to base', () => {
      const override = new CSSStyleSheet()
      override.replaceSync(':root { --val-color-bg: red; }')
      themeManager.applyOverrides(override)
      themeManager.clearOverrides()
      expect(themeManager.getActiveSheet()).toBe(lightTokenSheet)
    })
  })
})
