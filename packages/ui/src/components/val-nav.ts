import { ValElement } from '../core/val-element.js'

export class ValNav extends ValElement {
  static observedAttributes = ['direction']

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
      this.setAttribute('role', 'navigation')
      this.style.display = 'flex'
      this.style.alignItems = 'center'
      this.style.gap = 'var(--val-space-1)'
      this.style.fontFamily = 'var(--val-font-sans)'
      this.style.fontSize = 'var(--val-text-sm)'
      this.initialized = true
    }
    this.syncDirection()
    this.addEventListener('click', this.handleClick)
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.removeEventListener('click', this.handleClick)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (name === 'direction') this.syncDirection()
  }

  private syncDirection (): void {
    const dir = this.getAttribute('direction')
    this.style.flexDirection = dir === 'vertical' ? 'column' : 'row'
  }

  private handleClick = (e: Event): void => {
    const anchor = (e.target as HTMLElement).closest('a')
    if (anchor === null) return
    const href = anchor.getAttribute('href') ?? ''
    this.emitInteraction('navigate', { href })
  }
}
