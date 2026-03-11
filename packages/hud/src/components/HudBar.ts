import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'

export class HudBar extends HTMLElement {
  static observedAttributes = ['label', 'value', 'percent', 'color']

  private _initialized = false
  private labelEl: HTMLSpanElement | null = null
  private valueEl: HTMLSpanElement | null = null
  private fill: HTMLDivElement | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.gap = HUD_SPACING.xs

    const header = document.createElement('div')
    header.style.display = 'flex'
    header.style.justifyContent = 'space-between'
    header.style.alignItems = 'center'

    this.labelEl = document.createElement('span')
    this.labelEl.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    this.labelEl.style.fontSize = HUD_TYPOGRAPHY.scale.sm
    this.labelEl.style.color = HUD_COLORS.textPrimary
    this.labelEl.textContent = this.getAttribute('label') ?? ''

    this.valueEl = document.createElement('span')
    this.valueEl.style.fontFamily = HUD_TYPOGRAPHY.fontMono
    this.valueEl.style.fontSize = HUD_TYPOGRAPHY.scale.sm
    this.valueEl.style.color = HUD_COLORS.textSecondary
    this.valueEl.style.fontVariantNumeric = 'tabular-nums'
    this.valueEl.textContent = this.getAttribute('value') ?? ''

    header.appendChild(this.labelEl)
    header.appendChild(this.valueEl)

    const track = document.createElement('div')
    track.style.width = '100%'
    track.style.height = '6px'
    track.style.backgroundColor = HUD_COLORS.border
    track.style.borderRadius = '3px'

    this.fill = document.createElement('div')
    this.fill.style.height = '100%'
    this.fill.style.borderRadius = '3px'
    this.fill.style.backgroundColor = this.getAttribute('color') ?? HUD_COLORS.accent
    this.fill.style.width = this.clampPercent(this.getAttribute('percent')) + '%'

    track.appendChild(this.fill)
    this.appendChild(header)
    this.appendChild(track)
  }

  disconnectedCallback (): void {
    // Intentional no-op
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _old: string | null, value: string | null): void {
    const handlers: Record<string, () => void> = {
      label: () => { if (this.labelEl !== null) this.labelEl.textContent = value ?? '' },
      value: () => { if (this.valueEl !== null) this.valueEl.textContent = value ?? '' },
      percent: () => { if (this.fill !== null) this.fill.style.width = this.clampPercent(value) + '%' },
      color: () => { if (this.fill !== null) this.fill.style.backgroundColor = value ?? HUD_COLORS.accent }
    }
    handlers[name]?.()
  }

  private clampPercent (raw: string | null): number {
    const n = Number(raw)
    if (Number.isNaN(n)) return 0
    return Math.min(100, Math.max(0, n))
  }
}

customElements.define('hud-bar', HudBar)
