interface NavigationDetail {
  readonly source: 'cache' | 'prefetch' | 'network'
  readonly durationMs: number
  readonly fromUrl: string
  readonly toUrl: string
}

// Module-level counters survive component destruction/recreation (AV Rule 206)
const counters = {
  totalNavigations: 0,
  cacheHits: 0,
  networkFetches: 0,
  prefetchHits: 0,
  cacheTotalMs: 0,
  networkTotalMs: 0
}

const sourceHandlers: Record<string, (detail: NavigationDetail) => void> = {
  cache: (d) => { counters.cacheHits++; counters.cacheTotalMs += d.durationMs },
  prefetch: (d) => { counters.prefetchHits++; counters.cacheTotalMs += d.durationMs },
  network: (d) => { counters.networkFetches++; counters.networkTotalMs += d.durationMs }
}

// Module-level listener — always active, accumulates stats even when component is detached
let activeInstance: InertiaSpeedShowcase | null = null

function onNavigated (e: Event): void {
  const detail = (e as CustomEvent).detail as NavigationDetail | undefined
  if (detail === undefined) return
  counters.totalNavigations++
  sourceHandlers[detail.source]?.(detail)
  activeInstance?._updateDisplay()
}

document.addEventListener('inertia:navigated', onNavigated)

// Test-only: reset accumulated counters
export function resetNavCounters (): void {
  counters.totalNavigations = 0
  counters.cacheHits = 0
  counters.networkFetches = 0
  counters.prefetchHits = 0
  counters.cacheTotalMs = 0
  counters.networkTotalMs = 0
}

export class InertiaSpeedShowcase extends HTMLElement {
  private _initialized = false
  private _totalEl: HTMLSpanElement | null = null
  private _hitRateEl: HTMLSpanElement | null = null
  private _avgCacheEl: HTMLSpanElement | null = null
  private _avgNetworkEl: HTMLSpanElement | null = null
  private _promptEl: HTMLElement | null = null
  private _statsEl: HTMLElement | null = null

  connectedCallback (): void {
    if (!this._initialized) {
      this._initialized = true
      this.innerHTML = `
        <div class="speed-showcase-inner" style="font-family:monospace;padding:24px;border:1px solid hsl(215,15%,20%);border-radius:8px;background:hsl(220,13%,8%);">
          <p class="speed-prompt" style="color:hsl(215,20%,60%);margin:0 0 16px;">Navigate between pages. Watch the difference.</p>
          <div class="speed-stats" style="display:none;gap:16px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 24px;">
              <div><span class="speed-label" style="color:hsl(215,20%,50%);font-size:12px;">Cache hits</span><br><span data-stat="hitRate" style="color:hsl(215,60%,55%);font-size:18px;font-weight:bold;">0%</span></div>
              <div><span class="speed-label" style="color:hsl(215,20%,50%);font-size:12px;">Avg cached</span><br><span data-stat="avgCache" style="color:hsl(160,60%,45%);font-size:18px;font-weight:bold;">0ms</span></div>
              <div><span class="speed-label" style="color:hsl(215,20%,50%);font-size:12px;">Avg network</span><br><span data-stat="avgNetwork" style="color:hsl(200,60%,50%);font-size:18px;font-weight:bold;">0ms</span></div>
              <div><span class="speed-label" style="color:hsl(215,20%,50%);font-size:12px;">Total navigations</span><br><span data-stat="total" style="color:hsl(215,20%,70%);font-size:18px;font-weight:bold;">0</span></div>
            </div>
          </div>
        </div>
      `
      this._promptEl = this.querySelector('.speed-prompt')
      this._statsEl = this.querySelector('.speed-stats')
      this._totalEl = this.querySelector('[data-stat="total"]')
      this._hitRateEl = this.querySelector('[data-stat="hitRate"]')
      this._avgCacheEl = this.querySelector('[data-stat="avgCache"]')
      this._avgNetworkEl = this.querySelector('[data-stat="avgNetwork"]')
    }

    activeInstance = this

    // Show accumulated stats from navigations that happened while detached
    if (counters.totalNavigations > 0) {
      this._updateDisplay()
    }
  }

  connectedMoveCallback (): void {
    // No-op — preserve state across moveBefore()
  }

  disconnectedCallback (): void {
    if (activeInstance === this) {
      activeInstance = null
    }
  }

  _updateDisplay (): void {
    const c = counters

    if (this._promptEl !== null) this._promptEl.style.display = 'none'
    if (this._statsEl !== null) this._statsEl.style.display = 'block'

    if (this._totalEl !== null) {
      this._totalEl.textContent = String(c.totalNavigations)
    }

    if (this._hitRateEl !== null) {
      const cachedTotal = c.cacheHits + c.prefetchHits
      const rate = c.totalNavigations > 0
        ? Math.round((cachedTotal / c.totalNavigations) * 100)
        : 0
      this._hitRateEl.textContent = `${String(rate)}%`
    }

    if (this._avgCacheEl !== null) {
      const cachedCount = c.cacheHits + c.prefetchHits
      const avg = cachedCount > 0 ? Math.round(c.cacheTotalMs / cachedCount) : 0
      this._avgCacheEl.textContent = `${String(avg)}ms`
    }

    if (this._avgNetworkEl !== null) {
      const avg = c.networkFetches > 0 ? Math.round(c.networkTotalMs / c.networkFetches) : 0
      this._avgNetworkEl.textContent = `${String(avg)}ms`
    }
  }
}

customElements.define('inertia-speed-showcase', InertiaSpeedShowcase)
