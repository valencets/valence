import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'
import type { HudPeriod } from '../types.js'

const PERIODS: ReadonlyArray<{ value: HudPeriod; label: string }> = [
  { value: 'TODAY', label: 'Today' },
  { value: '7D', label: '7d' },
  { value: '30D', label: '30d' },
  { value: '90D', label: '90d' }
]

export class HudTimeRange extends HTMLElement {
  static observedAttributes = ['period']

  private _initialized = false
  private buttons: HTMLButtonElement[] = []
  private handleClick: ((e: Event) => void) | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.setAttribute('role', 'group')
    this.setAttribute('aria-label', 'Time range')
    this.style.display = 'inline-flex'
    this.style.gap = HUD_SPACING.xs

    for (const p of PERIODS) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.textContent = p.label
      btn.dataset.period = p.value
      btn.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
      btn.style.fontSize = HUD_TYPOGRAPHY.scale.sm
      btn.style.border = 'none'
      btn.style.borderRadius = '4px'
      btn.style.padding = `${HUD_SPACING.xs} ${HUD_SPACING.sm}`
      btn.style.cursor = 'pointer'
      this.buttons.push(btn)
      this.appendChild(btn)
    }

    this.handleClick = (e: Event) => {
      const target = e.target as HTMLElement
      const period = target.dataset.period
      if (period === undefined) return

      this.setAttribute('period', period)
      this.dispatchEvent(new CustomEvent('hud-period-change', {
        detail: { period },
        bubbles: true
      }))
    }

    this.addEventListener('click', this.handleClick)
    this.updateActive()
  }

  disconnectedCallback (): void {
    if (this.handleClick !== null) {
      this.removeEventListener('click', this.handleClick)
      this.handleClick = null
    }
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _old: string | null, _value: string | null): void {
    const handlers: Record<string, () => void> = {
      period: () => this.updateActive()
    }
    handlers[name]?.()
  }

  private updateActive (): void {
    const current = this.getAttribute('period') ?? '7D'
    for (const btn of this.buttons) {
      const isActive = btn.dataset.period === current
      btn.style.backgroundColor = isActive ? HUD_COLORS.accent : 'transparent'
      btn.style.color = isActive ? HUD_COLORS.bg : HUD_COLORS.textSecondary
    }
  }
}

customElements.define('hud-timerange', HudTimeRange)
