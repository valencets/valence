import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'

export class HudMetric extends HTMLElement {
  static observedAttributes = ['label', 'value', 'delta', 'delta-direction', 'sparkline-data']

  private _initialized = false
  private labelEl: HTMLSpanElement | null = null
  private valueEl: HTMLSpanElement | null = null
  private deltaEl: HTMLSpanElement | null = null
  private sparkline: HTMLElement | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.style.display = 'flex'
    this.style.flexDirection = 'column'
    this.style.gap = HUD_SPACING.sm

    this.labelEl = document.createElement('span')
    this.labelEl.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    this.labelEl.style.fontSize = HUD_TYPOGRAPHY.scale.xs
    this.labelEl.style.color = HUD_COLORS.textSecondary
    this.labelEl.style.textTransform = 'uppercase'
    this.labelEl.style.letterSpacing = '0.05em'
    this.labelEl.textContent = this.getAttribute('label') ?? ''

    this.valueEl = document.createElement('span')
    this.valueEl.style.fontFamily = HUD_TYPOGRAPHY.fontMono
    this.valueEl.style.fontSize = HUD_TYPOGRAPHY.scale.xl
    this.valueEl.style.lineHeight = HUD_TYPOGRAPHY.lineHeight.metric
    this.valueEl.style.color = HUD_COLORS.textPrimary
    this.valueEl.style.fontVariantNumeric = 'tabular-nums'
    this.valueEl.textContent = this.getAttribute('value') ?? '--'

    this.sparkline = document.createElement('hud-sparkline')
    const sparkData = this.getAttribute('sparkline-data')
    if (sparkData !== null) {
      this.sparkline.setAttribute('data', sparkData)
    }

    this.deltaEl = document.createElement('span')
    this.deltaEl.style.fontFamily = HUD_TYPOGRAPHY.fontMono
    this.deltaEl.style.fontSize = HUD_TYPOGRAPHY.scale.sm
    this.updateDelta()

    this.appendChild(this.labelEl)
    this.appendChild(this.valueEl)
    this.appendChild(this.sparkline)
    this.appendChild(this.deltaEl)
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
      value: () => { if (this.valueEl !== null) this.valueEl.textContent = value ?? '--' },
      delta: () => this.updateDelta(),
      'delta-direction': () => this.updateDelta(),
      'sparkline-data': () => { if (this.sparkline !== null) this.sparkline.setAttribute('data', value ?? '') }
    }
    handlers[name]?.()
  }

  private updateDelta (): void {
    if (this.deltaEl === null) return
    const delta = this.getAttribute('delta') ?? ''
    const direction = this.getAttribute('delta-direction') ?? 'flat'

    this.deltaEl.textContent = delta

    const colorMap: Record<string, string> = {
      up: HUD_COLORS.positive,
      down: HUD_COLORS.negative,
      flat: HUD_COLORS.neutral
    }
    this.deltaEl.style.color = colorMap[direction] ?? HUD_COLORS.neutral

    this.deltaEl.className = ''
    const classMap: Record<string, string> = {
      up: 'positive',
      down: 'negative',
      flat: 'flat'
    }
    const cls = classMap[direction]
    if (cls !== undefined) {
      this.deltaEl.classList.add(cls)
    }
  }
}

customElements.define('hud-metric', HudMetric)
