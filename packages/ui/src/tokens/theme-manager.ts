// ThemeManager — singleton for programmatic theme switching via Constructable Stylesheets.
// Follows the localeObserver pattern: components subscribe their shadow roots,
// ThemeManager adopts the active token sheet into each.

import { lightTokenSheet, darkTokenSheet, mergeTokenSheets } from './token-sheets.js'

export const ThemeMode = {
  Light: 'light',
  Dark: 'dark',
  System: 'system',
} as const

export type ThemeMode = typeof ThemeMode[keyof typeof ThemeMode]

type ResolvedTheme = 'light' | 'dark'

const darkMatcher: { matches: boolean, addEventListener: (t: string, h: (e: MediaQueryListEvent) => void) => void, removeEventListener: (t: string, h: (e: MediaQueryListEvent) => void) => void } =
  typeof matchMedia === 'function'
    ? matchMedia('(prefers-color-scheme: dark)')
    : { matches: false, addEventListener () {}, removeEventListener () {} }

class ThemeManagerImpl {
  private _mode: ThemeMode = ThemeMode.Light
  private readonly _roots = new Set<ShadowRoot>()
  private _overrideSheet: CSSStyleSheet | null = null
  private _activeSheet: CSSStyleSheet = lightTokenSheet
  private readonly _systemHandler = (e: MediaQueryListEvent): void => {
    if (this._mode !== ThemeMode.System) return
    this._applyResolved(e.matches ? 'dark' : 'light')
  }

  resolveTheme (): ResolvedTheme {
    const resolved: Record<ThemeMode, () => ResolvedTheme> = {
      [ThemeMode.Light]: () => 'light',
      [ThemeMode.Dark]: () => 'dark',
      [ThemeMode.System]: () => darkMatcher.matches ? 'dark' : 'light',
    }
    return resolved[this._mode]()
  }

  setTheme (mode: ThemeMode): void {
    this._mode = mode
    if (mode === ThemeMode.System) {
      darkMatcher.addEventListener('change', this._systemHandler)
    } else {
      darkMatcher.removeEventListener('change', this._systemHandler)
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
    darkMatcher.removeEventListener('change', this._systemHandler)
    this._roots.clear()
    this._overrideSheet = null
    this._mode = ThemeMode.Light
    this._activeSheet = lightTokenSheet
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
