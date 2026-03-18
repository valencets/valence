import { ValElement } from '../core/val-element.js'

interface BadgeVariantStyle {
  background: string
  color: string
}

const VARIANTS: Record<string, BadgeVariantStyle> = {
  neutral: { background: 'var(--val-color-bg-muted)', color: 'var(--val-color-text)' },
  success: { background: 'var(--val-green-100)', color: 'var(--val-green-700)' },
  error: { background: 'var(--val-red-100)', color: 'var(--val-red-700)' },
  warning: { background: 'var(--val-amber-100)', color: 'var(--val-amber-700)' },
  info: { background: 'var(--val-blue-100)', color: 'var(--val-blue-700)' }
}

export class ValBadge extends ValElement {
  static observedAttributes = ['variant']

  private initialized = false

  constructor () {
    super({ shadow: false })
  }

  protected createTemplate (): HTMLTemplateElement {
    return document.createElement('template')
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (!this.initialized) {
      this.setAttribute('role', 'status')
      this.style.display = 'inline-flex'
      this.style.alignItems = 'center'
      this.style.fontFamily = 'var(--val-font-sans)'
      this.style.fontSize = 'var(--val-text-xs)'
      this.style.fontWeight = 'var(--val-weight-medium)'
      this.style.lineHeight = '1'
      this.style.borderRadius = 'var(--val-radius-full)'
      this.style.paddingLeft = 'var(--val-space-2)'
      this.style.paddingRight = 'var(--val-space-2)'
      this.style.paddingTop = 'var(--val-space-1)'
      this.style.paddingBottom = 'var(--val-space-1)'
      this.initialized = true
    }
    this.syncVariant()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (name === 'variant') this.syncVariant()
  }

  private syncVariant (): void {
    const variant = this.getAttribute('variant') ?? 'neutral'
    const styles = VARIANTS[variant] ?? VARIANTS.neutral!
    this.style.background = styles.background
    this.style.color = styles.color
  }
}

customElements.define('val-badge', ValBadge)
