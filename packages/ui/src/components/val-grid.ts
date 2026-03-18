import { ValElement } from '../core/val-element.js'

function resolveSpace (value: string | null): string {
  if (value === null || value === '') return ''
  if (/^\d+$/.test(value)) return `var(--val-space-${value})`
  return value
}

function resolveColumns (value: string | null): string {
  if (value === null || value === '') return ''
  if (/^\d+$/.test(value)) return `repeat(${value}, 1fr)`
  return value
}

export class ValGrid extends ValElement {
  static observedAttributes = ['columns', 'rows', 'gap', 'align', 'justify']

  constructor () {
    super({ shadow: false })
  }

  protected createTemplate (): HTMLTemplateElement {
    return document.createElement('template')
  }

  connectedCallback (): void {
    super.connectedCallback()
    this.style.display = 'grid'
    this.syncStyles()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    this.syncStyles()
  }

  private syncStyles (): void {
    this.style.gridTemplateColumns = resolveColumns(this.getAttribute('columns'))
    this.style.gridTemplateRows = this.getAttribute('rows') ?? ''
    this.style.gap = resolveSpace(this.getAttribute('gap'))
    this.style.alignItems = this.getAttribute('align') ?? ''
    this.style.justifyItems = this.getAttribute('justify') ?? ''
  }
}

customElements.define('val-grid', ValGrid)
