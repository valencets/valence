interface NavigationDetail {
  readonly source: 'cache' | 'prefetch' | 'network'
  readonly durationMs: number
  readonly fromUrl: string
  readonly toUrl: string
}

const SOURCE_COLORS: Record<string, string> = {
  cache: 'hsl(215,60%,55%)',
  prefetch: 'hsl(160,60%,45%)',
  network: 'hsl(200,60%,50%)'
}

const HOLD_DURATION_MS = 2500

export class InertiaCacheIndicator extends HTMLElement {
  private _initialized = false
  private _fadeTimeout: ReturnType<typeof setTimeout> | null = null
  private _labelEl: HTMLSpanElement | null = null
  private _onNavigated: ((e: Event) => void) | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true

    this.setAttribute('role', 'status')
    this.setAttribute('aria-live', 'polite')
    this.style.cssText = `
      position: fixed;
      bottom: 48px;
      right: 16px;
      z-index: 9999;
      padding: 6px 12px;
      border-radius: 999px;
      font-family: monospace;
      font-size: 12px;
      line-height: 1;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
    `

    this._labelEl = document.createElement('span')
    this.appendChild(this._labelEl)

    this._onNavigated = (e: Event) => {
      const detail = (e as CustomEvent).detail as NavigationDetail | undefined
      if (detail === undefined) return
      this._show(detail)
    }
    document.addEventListener('inertia:navigated', this._onNavigated)
  }

  connectedMoveCallback (): void {
    // No-op — preserve state across moveBefore()
  }

  disconnectedCallback (): void {
    if (this._onNavigated !== null) {
      document.removeEventListener('inertia:navigated', this._onNavigated)
      this._onNavigated = null
    }
    if (this._fadeTimeout !== null) {
      clearTimeout(this._fadeTimeout)
      this._fadeTimeout = null
    }
  }

  private _show (detail: NavigationDetail): void {
    if (this._labelEl === null) return

    const color = SOURCE_COLORS[detail.source] ?? 'hsl(200,60%,50%)'
    this.style.backgroundColor = color
    this.style.color = '#fff'
    this._labelEl.textContent = `${String(detail.durationMs)}ms \u00B7 ${detail.source}`

    // Animate in
    this.style.opacity = '1'
    this.style.transform = 'translateY(0)'

    // Clear previous timeout
    if (this._fadeTimeout !== null) {
      clearTimeout(this._fadeTimeout)
    }

    // Fade out after hold
    this._fadeTimeout = setTimeout(() => {
      this.style.opacity = '0'
      this.style.transform = 'translateY(8px)'
    }, HOLD_DURATION_MS)
  }
}

customElements.define('inertia-cache-indicator', InertiaCacheIndicator)
