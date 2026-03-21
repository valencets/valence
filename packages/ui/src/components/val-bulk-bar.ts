import { ValElement } from '../core/val-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host {
    display: none;
    align-items: center;
    gap: var(--val-space-3, 0.75rem);
    padding: var(--val-space-2, 0.5rem) var(--val-space-3, 0.75rem);
    background: var(--val-color-bg-elevated);
    border: 1px solid var(--val-color-border);
    border-radius: var(--val-radius-md);
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    color: var(--val-color-text);
  }
  :host([visible]) { display: flex; }
  .count {
    font-weight: var(--val-weight-semibold);
    color: var(--val-color-text-muted);
  }
</style>
<span class="count" aria-live="polite"></span>
<slot></slot>
`

export class ValBulkBar extends ValElement {
  static observedAttributes = ['checkbox-selector']

  private countEl: HTMLElement | null = null
  private selectedCount = 0

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  connectedCallback (): void {
    super.connectedCallback()
    this.countEl = this.shadowRoot!.querySelector('.count')
    document.addEventListener('change', this.handleChange)
    this.update()
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    document.removeEventListener('change', this.handleChange)
  }

  get checkboxSelector (): string {
    return this.getAttribute('checkbox-selector') ?? '.bulk-row-check'
  }

  get count (): number {
    return this.selectedCount
  }

  update (): void {
    const checked = document.querySelectorAll<HTMLInputElement>(`${this.checkboxSelector}:checked`)
    this.selectedCount = checked.length
    if (this.countEl !== null) {
      this.countEl.textContent = `${this.selectedCount} selected`
    }
    if (this.selectedCount > 0) {
      this.setAttribute('visible', '')
    } else {
      this.removeAttribute('visible')
    }
    this.emitInteraction('count-change', { count: this.selectedCount })
  }

  selectAll (): void {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(this.checkboxSelector)
    for (const cb of checkboxes) {
      cb.checked = true
    }
    this.update()
  }

  deselectAll (): void {
    const checkboxes = document.querySelectorAll<HTMLInputElement>(this.checkboxSelector)
    for (const cb of checkboxes) {
      cb.checked = false
    }
    this.update()
  }

  private handleChange = (e: Event): void => {
    const target = e.target
    if (target instanceof HTMLInputElement && target.matches(this.checkboxSelector)) {
      this.update()
    }
  }
}
