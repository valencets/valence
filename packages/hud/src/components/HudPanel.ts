import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'

export class HudPanel extends HTMLElement {
  static observedAttributes = ['label']

  private _initialized = false
  private headerEl: HTMLSpanElement | null = null
  private contentEl: HTMLDivElement | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.setAttribute('role', 'region')
    const label = this.getAttribute('label') ?? ''
    this.setAttribute('aria-label', label)

    this.style.backgroundColor = HUD_COLORS.surface
    this.style.padding = HUD_SPACING.lg
    this.style.borderRadius = '8px'

    this.headerEl = document.createElement('span')
    this.headerEl.style.display = 'block'
    this.headerEl.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    this.headerEl.style.fontSize = HUD_TYPOGRAPHY.scale.xs
    this.headerEl.style.color = HUD_COLORS.textSecondary
    this.headerEl.style.textTransform = 'uppercase'
    this.headerEl.style.letterSpacing = '0.05em'
    this.headerEl.style.marginBottom = HUD_SPACING.md
    this.headerEl.textContent = label

    this.contentEl = document.createElement('div')

    // Move existing children into content wrapper
    const children = Array.from(this.childNodes)
    for (const child of children) {
      this.contentEl.appendChild(child)
    }

    this.appendChild(this.headerEl)
    this.appendChild(this.contentEl)
  }

  disconnectedCallback (): void {
    // Intentional no-op
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _old: string | null, value: string | null): void {
    const handlers: Record<string, () => void> = {
      label: () => {
        if (this.headerEl !== null) this.headerEl.textContent = value ?? ''
        this.setAttribute('aria-label', value ?? '')
      }
    }
    handlers[name]?.()
  }
}

customElements.define('hud-panel', HudPanel)
