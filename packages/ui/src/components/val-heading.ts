import { ValElement } from '../core/val-element.js'

const LEVEL_FONT_SIZE: Record<string, string> = {
  1: 'var(--val-text-5xl)',
  2: 'var(--val-text-3xl)',
  3: 'var(--val-text-2xl)',
  4: 'var(--val-text-xl)',
  5: 'var(--val-text-lg)',
  6: 'var(--val-text-base)'
}

export class ValHeading extends ValElement {
  static observedAttributes = ['level']

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
      this.setAttribute('role', 'heading')
      this.style.display = 'block'
      this.style.fontFamily = 'var(--val-font-sans)'
      this.style.fontWeight = 'var(--val-weight-bold)'
      this.style.lineHeight = 'var(--val-leading-tight)'
      this.style.color = 'var(--val-color-text)'
      this.initialized = true
    }
    this.syncLevel()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (name === 'level') this.syncLevel()
  }

  private syncLevel (): void {
    const raw = this.getAttribute('level') ?? '2'
    const n = Number(raw)
    const level = String(n >= 1 && n <= 6 ? n : 2)
    this.setAttribute('aria-level', level)
    this.style.fontSize = LEVEL_FONT_SIZE[level] ?? LEVEL_FONT_SIZE['2']!
  }
}

customElements.define('val-heading', ValHeading)
