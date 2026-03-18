import { ValElement } from '../core/val-element.js'

function resolveSpace (value: string | null): string {
  if (value === null || value === '') return ''
  if (/^\d+$/.test(value)) return `var(--val-space-${value})`
  return value
}

export class ValSection extends ValElement {
  static observedAttributes = ['max-width', 'padding', 'center']

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
      this.setAttribute('role', 'region')
      this.initialized = true
    }
    this.syncStyles()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    this.syncStyles()
  }

  private syncStyles (): void {
    this.style.maxWidth = this.getAttribute('max-width') ?? ''
    this.style.padding = resolveSpace(this.getAttribute('padding'))
    const center = this.hasAttribute('center')
    this.style.marginLeft = center ? 'auto' : ''
    this.style.marginRight = center ? 'auto' : ''
  }
}

customElements.define('val-section', ValSection)
