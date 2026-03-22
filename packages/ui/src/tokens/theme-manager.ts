// ThemeManager — singleton for programmatic theme switching via Constructable Stylesheets.
// Follows the localeObserver pattern: components subscribe their shadow roots,
// ThemeManager adopts the active token sheet into each.
//
// ## Token Override Cascade Rule
//
// ValElement tokens (--val-*) MUST be overridden via applyOverrides(), never via
// document-level CSS selectors (e.g., `val-input { --val-color-border: transparent }`).
//
// Adopted stylesheets set :host {} rules inside shadow roots. These beat document-level
// element selectors for CSS custom properties because :host is resolved within the
// shadow tree's cascade context. Document-level overrides appear to work in dev tools
// but are silently overridden by the adopted sheet on next theme update.
//
// Correct:
//   themeManager.applyOverrides(createTokenSheet(`:host, :root {
//     --val-color-border: transparent;
//   }`))
//
// Wrong (will be overridden by adopted sheet):
//   val-input { --val-color-border: transparent; }
//
// ## Token Contract
//
// Components consume these tokens (set via token sheets, not component source):
//   Colors:    --val-color-primary, --val-color-primary-hover, --val-color-primary-text,
//              --val-color-bg, --val-color-bg-elevated, --val-color-bg-muted,
//              --val-color-text, --val-color-text-muted, --val-color-text-inverted,
//              --val-color-border, --val-color-border-focus,
//              --val-color-error, --val-color-success, --val-color-warning
//   Layout:    --val-focus-ring, --val-radius-sm, --val-radius-md, --val-radius-lg,
//              --val-shadow-sm, --val-shadow-md, --val-shadow-lg
//   Spacing:   --val-space-0 through --val-space-24
//   Typography: --val-font-sans, --val-font-mono, --val-text-xs through --val-text-5xl,
//              --val-weight-normal, --val-weight-medium, --val-weight-semibold, --val-weight-bold,
//              --val-leading-tight, --val-leading-normal, --val-leading-relaxed
//   Animation: --val-duration-fast, --val-duration-normal, --val-duration-slow,
//              --val-ease-in, --val-ease-out, --val-ease-in-out

import { lightTokenSheet, darkTokenSheet, mergeTokenSheets } from './token-sheets.js'

export const ThemeMode = {
  Light: 'light',
  Dark: 'dark',
  System: 'system',
} as const

export type ThemeMode = typeof ThemeMode[keyof typeof ThemeMode]

type ResolvedTheme = 'light' | 'dark'

interface DarkMatcher {
  matches: boolean
  addEventListener (t: string, h: (e: MediaQueryListEvent) => void): void
  removeEventListener (t: string, h: (e: MediaQueryListEvent) => void): void
}

function getDarkMatcher (): DarkMatcher {
  if (typeof globalThis.matchMedia === 'function') {
    return globalThis.matchMedia('(prefers-color-scheme: dark)')
  }
  return { matches: false, addEventListener () {}, removeEventListener () {} }
}

class ThemeManagerImpl {
  private _mode: ThemeMode = ThemeMode.Light
  private readonly _roots = new Set<ShadowRoot>()
  private _overrideSheet: CSSStyleSheet | null = null
  private _activeSheet: CSSStyleSheet = lightTokenSheet
  private _darkMatcher: DarkMatcher = getDarkMatcher()
  private readonly _systemHandler = (e: MediaQueryListEvent): void => {
    if (this._mode !== ThemeMode.System) return
    this._applyResolved(e.matches ? 'dark' : 'light')
  }

  resolveTheme (): ResolvedTheme {
    const resolved: Record<ThemeMode, () => ResolvedTheme> = {
      [ThemeMode.Light]: () => 'light',
      [ThemeMode.Dark]: () => 'dark',
      [ThemeMode.System]: () => this._darkMatcher.matches ? 'dark' : 'light',
    }
    return resolved[this._mode]()
  }

  setTheme (mode: ThemeMode): void {
    this._mode = mode
    if (mode === ThemeMode.System) {
      this._darkMatcher.addEventListener('change', this._systemHandler)
    } else {
      this._darkMatcher.removeEventListener('change', this._systemHandler)
    }
    this._applyResolved(this.resolveTheme())
    document.dispatchEvent(new CustomEvent('val:theme-change', {
      detail: { mode, resolved: this.resolveTheme() },
    }))
  }

  getActiveSheet (): CSSStyleSheet {
    return this._activeSheet
  }

  subscribe (root: ShadowRoot): void {
    this._roots.add(root)
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, this._activeSheet]
  }

  unsubscribe (root: ShadowRoot): void {
    this._roots.delete(root)
    root.adoptedStyleSheets = root.adoptedStyleSheets.filter(
      s => s !== this._activeSheet && s !== lightTokenSheet && s !== darkTokenSheet
    )
  }

  applyOverrides (sheet: CSSStyleSheet): void {
    this._overrideSheet = sheet
    const base = this.resolveTheme() === 'dark' ? darkTokenSheet : lightTokenSheet
    this._updateActive(mergeTokenSheets(base, sheet))
  }

  clearOverrides (): void {
    this._overrideSheet = null
    const base = this.resolveTheme() === 'dark' ? darkTokenSheet : lightTokenSheet
    this._updateActive(base)
  }

  /** Test-only: reset all state. */
  _reset (): void {
    this._darkMatcher.removeEventListener('change', this._systemHandler)
    this._roots.clear()
    this._overrideSheet = null
    this._mode = ThemeMode.Light
    this._activeSheet = lightTokenSheet
    this._darkMatcher = getDarkMatcher()
  }

  private _applyResolved (resolved: ResolvedTheme): void {
    const base = resolved === 'dark' ? darkTokenSheet : lightTokenSheet
    if (this._overrideSheet !== null) {
      this._updateActive(mergeTokenSheets(base, this._overrideSheet))
    } else {
      this._updateActive(base)
    }
  }

  private _updateActive (newSheet: CSSStyleSheet): void {
    const oldSheet = this._activeSheet
    this._activeSheet = newSheet
    for (const root of this._roots) {
      root.adoptedStyleSheets = root.adoptedStyleSheets
        .filter(s => s !== oldSheet)
        .concat([newSheet])
    }
  }
}

export const themeManager = new ThemeManagerImpl()
