import { ValElement } from '../core/val-element.js'
import { resolveSpace } from '../core/resolve-space.js'

const JUSTIFY_MAP: Record<string, string> = {
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly'
}

export class ValStack extends ValElement {
  static observedAttributes = ['direction', 'gap', 'align', 'justify', 'wrap']

  constructor () {
    super({ shadow: false })
  }

  protected createTemplate (): HTMLTemplateElement {
    return document.createElement('template')
  }

  connectedCallback (): void {
    super.connectedCallback()
    this.style.display = 'flex'
    this.syncStyles()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    this.syncStyles()
  }

  private syncStyles (): void {
    const dir = this.getAttribute('direction')
    this.style.flexDirection = dir === 'row' ? 'row' : 'column'
    this.style.gap = resolveSpace(this.getAttribute('gap'))
    this.style.alignItems = this.getAttribute('align') ?? ''
    const justify = this.getAttribute('justify') ?? ''
    this.style.justifyContent = JUSTIFY_MAP[justify] ?? justify
    this.style.flexWrap = this.hasAttribute('wrap') ? 'wrap' : ''
  }
}
