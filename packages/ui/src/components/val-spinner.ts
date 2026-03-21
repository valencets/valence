import { ValElement } from '../core/val-element.js'

const SIZE_MAP: Record<string, string> = {
  sm: '1rem',
  md: '1.5rem',
  lg: '2.5rem'
}

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: inline-flex; align-items: center; justify-content: center; }
  svg {
    animation: val-spin 0.75s linear infinite;
    color: var(--val-color-primary);
  }
  @keyframes val-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
<div role="status" aria-label="Loading">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
</div>
`

export class ValSpinner extends ValElement {
  static observedAttributes = ['size', 'label']

  private svgEl: SVGElement | null = null
  private statusEl: HTMLElement | null = null

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.svgEl === null) {
      this.svgEl = this.shadowRoot!.querySelector('svg')!
      this.statusEl = this.shadowRoot!.querySelector('[role="status"]')!
    }
    this.syncSize()
    this.syncLabel()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (this.svgEl === null) return
    if (name === 'size') this.syncSize()
    if (name === 'label') this.syncLabel()
  }

  private syncSize (): void {
    const size = SIZE_MAP[this.getAttribute('size') ?? 'md'] ?? SIZE_MAP.md!
    this.svgEl!.style.width = size
    this.svgEl!.style.height = size
  }

  private syncLabel (): void {
    const label = this.getAttribute('label') ?? 'Loading'
    this.statusEl!.setAttribute('aria-label', label)
  }
}
