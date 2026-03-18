import { ValElement } from '../core/val-element.js'

function resolveSpace (value: string | null): string {
  if (value === null || value === '') return ''
  if (/^\d+$/.test(value)) return `var(--val-space-${value})`
  return value
}

export class ValCard extends ValElement {
  static observedAttributes = ['padding', 'variant']

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
      this.style.display = 'block'
      this.style.borderRadius = 'var(--val-radius-lg)'
      this.style.borderWidth = '1px'
      this.style.borderStyle = 'solid'
      this.style.borderColor = 'var(--val-color-border)'
      this.style.fontFamily = 'var(--val-font-sans)'
      this.style.color = 'var(--val-color-text)'
      this.initialized = true
    }
    this.syncStyles()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    this.syncStyles()
  }

  private syncStyles (): void {
    const variant = this.getAttribute('variant')
    const padding = this.getAttribute('padding')

    this.style.padding = padding !== null ? resolveSpace(padding) : 'var(--val-space-4)'

    if (variant === 'flat') {
      this.style.background = 'var(--val-color-bg-elevated)'
      this.style.boxShadow = 'none'
    } else if (variant === 'muted') {
      this.style.background = 'var(--val-color-bg-muted)'
      this.style.boxShadow = 'none'
    } else {
      this.style.background = 'var(--val-color-bg-elevated)'
      this.style.boxShadow = 'var(--val-shadow-sm)'
    }
  }
}

customElements.define('val-card', ValCard)
