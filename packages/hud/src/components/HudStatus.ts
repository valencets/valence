import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'

type StatusState = 'nominal' | 'degraded' | 'offline'

const STATE_COLORS: Record<StatusState, string> = {
  nominal: HUD_COLORS.positive,
  degraded: HUD_COLORS.warning,
  offline: HUD_COLORS.negative
}

export class HudStatus extends HTMLElement {
  static observedAttributes = ['state', 'label']

  private _initialized = false
  private dot: HTMLSpanElement | null = null
  private labelEl: HTMLSpanElement | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.style.display = 'inline-flex'
    this.style.alignItems = 'center'
    this.style.gap = HUD_SPACING.xs

    this.dot = document.createElement('span')
    this.dot.style.width = '8px'
    this.dot.style.height = '8px'
    this.dot.style.borderRadius = '50%'
    this.dot.style.display = 'inline-block'
    this.dot.style.flexShrink = '0'

    this.labelEl = document.createElement('span')
    this.labelEl.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    this.labelEl.style.fontSize = HUD_TYPOGRAPHY.scale.xs
    this.labelEl.style.color = HUD_COLORS.textSecondary

    this.updateState()
    this.labelEl.textContent = this.getAttribute('label') ?? ''

    this.appendChild(this.dot)
    this.appendChild(this.labelEl)
  }

  disconnectedCallback (): void {
    // Intentional no-op
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _old: string | null, value: string | null): void {
    const handlers: Record<string, () => void> = {
      state: () => this.updateState(),
      label: () => { if (this.labelEl !== null) this.labelEl.textContent = value ?? '' }
    }
    handlers[name]?.()
  }

  private updateState (): void {
    if (this.dot === null) return
    const state = this.getAttribute('state') as StatusState | null
    const validState = (state !== null && state in STATE_COLORS) ? state : 'nominal'
    this.dot.style.backgroundColor = STATE_COLORS[validState]
  }
}

customElements.define('hud-status', HudStatus)
