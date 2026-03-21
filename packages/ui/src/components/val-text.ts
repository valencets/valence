import { ValElement } from '../core/val-element.js'

interface VariantStyle {
  fontSize: string
  fontFamily?: string
  fontWeight?: string
  lineHeight?: string
  color?: string
}

const VARIANTS: Record<string, VariantStyle> = {
  body: {
    fontSize: 'var(--val-text-base)',
    lineHeight: 'var(--val-leading-normal)'
  },
  small: {
    fontSize: 'var(--val-text-sm)',
    lineHeight: 'var(--val-leading-normal)'
  },
  large: {
    fontSize: 'var(--val-text-lg)',
    lineHeight: 'var(--val-leading-normal)'
  },
  caption: {
    fontSize: 'var(--val-text-xs)',
    lineHeight: 'var(--val-leading-normal)',
    color: 'var(--val-color-text-muted)'
  },
  label: {
    fontSize: 'var(--val-text-sm)',
    fontWeight: 'var(--val-weight-medium)',
    lineHeight: 'var(--val-leading-normal)'
  },
  code: {
    fontSize: 'var(--val-text-sm)',
    fontFamily: 'var(--val-font-mono)',
    lineHeight: 'var(--val-leading-normal)'
  }
}

export class ValText extends ValElement {
  static observedAttributes = ['variant', 'muted']

  constructor () {
    super({ shadow: false })
  }

  protected createTemplate (): HTMLTemplateElement {
    return document.createElement('template')
  }

  connectedCallback (): void {
    super.connectedCallback()
    this.style.display = 'inline'
    this.style.fontFamily = 'var(--val-font-sans)'
    this.style.color = 'var(--val-color-text)'
    this.syncStyles()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    this.syncStyles()
  }

  private syncStyles (): void {
    const variant = this.getAttribute('variant') ?? 'body'
    const styles = VARIANTS[variant] ?? VARIANTS.body!
    this.style.fontSize = styles.fontSize
    this.style.lineHeight = styles.lineHeight ?? ''
    this.style.fontFamily = styles.fontFamily ?? 'var(--val-font-sans)'
    this.style.fontWeight = styles.fontWeight ?? ''

    // Color: muted attr takes precedence, then variant default, then base
    if (this.hasAttribute('muted') || styles.color !== undefined) {
      this.style.color = 'var(--val-color-text-muted)'
    } else {
      this.style.color = 'var(--val-color-text)'
    }
  }
}
