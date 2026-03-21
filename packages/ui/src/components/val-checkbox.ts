import { ValFormElement } from '../core/val-form-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: inline-flex; align-items: center; gap: var(--val-space-2); cursor: pointer; }
  :host([disabled]) { opacity: 0.5; pointer-events: none; }
  .box {
    width: 1.125rem;
    height: 1.125rem;
    border: 2px solid var(--val-color-border);
    border-radius: var(--val-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--val-color-bg-elevated);
    transition: background var(--val-duration-fast) var(--val-ease-in-out),
                border-color var(--val-duration-fast) var(--val-ease-in-out);
    flex-shrink: 0;
  }
  .box:focus-visible { box-shadow: var(--val-focus-ring); }
  .box[aria-checked="true"] {
    background: var(--val-color-primary);
    border-color: var(--val-color-primary);
  }
  .box[aria-checked="mixed"] {
    background: var(--val-color-primary);
    border-color: var(--val-color-primary);
  }
  .check {
    display: none;
    width: 0.75rem;
    height: 0.75rem;
    color: var(--val-color-primary-text);
  }
  .box[aria-checked="true"] .check { display: block; }
  .box[aria-checked="mixed"] .check { display: block; }
  .label {
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    color: var(--val-color-text);
    user-select: none;
  }
</style>
<div class="box" role="checkbox" aria-checked="false" tabindex="0" part="box">
  <svg class="check" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="2,6 5,9 10,3"></polyline>
  </svg>
</div>
<span class="label" part="label"><slot></slot></span>
`

export class ValCheckbox extends ValFormElement {
  static observedAttributes = ['checked', 'indeterminate', 'disabled']

  private boxEl: HTMLElement | null = null
  private checked = false
  private indeterminate = false

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  get value (): string {
    return this.checked ? (this.getAttribute('value') ?? 'on') : ''
  }

  set value (_v: string) {
    // For checkbox, value is controlled by checked state
    // The value attribute sets what's submitted when checked
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.boxEl === null) {
      this.boxEl = this.shadowRoot!.querySelector('.box')!
    }
    this.checked = this.hasAttribute('checked')
    this.indeterminate = this.hasAttribute('indeterminate')
    this.syncState()
    this.addEventListener('click', this.handleClick)
    this.addEventListener('keydown', this.handleKeydown)
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.removeEventListener('click', this.handleClick)
    this.removeEventListener('keydown', this.handleKeydown)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (name === 'checked') {
      this.checked = val !== null
      this.indeterminate = false
      this.syncState()
    } else if (name === 'indeterminate') {
      this.indeterminate = val !== null
      this.syncState()
    } else if (name === 'disabled' && this.boxEl !== null) {
      this.boxEl.setAttribute('tabindex', val !== null ? '-1' : '0')
    }
  }

  formResetCallback (): void {
    this.checked = false
    this.indeterminate = false
    this.syncState()
    this.setFormValue('')
    this.clearValidity()
  }

  formDisabledCallback (disabled: boolean): void {
    if (this.boxEl !== null) {
      this.boxEl.setAttribute('tabindex', disabled ? '-1' : '0')
    }
  }

  private syncState (): void {
    if (this.boxEl === null) return
    const ariaVal = this.indeterminate ? 'mixed' : String(this.checked)
    this.boxEl.setAttribute('aria-checked', ariaVal)
    this.setFormValue(this.checked ? (this.getAttribute('value') ?? 'on') : '')
  }

  private toggle (): void {
    if (this.hasAttribute('disabled')) return
    this.checked = !this.checked
    this.indeterminate = false
    this.syncState()
    this.emitInteraction('change', { checked: this.checked })
  }

  private handleClick = (): void => {
    this.toggle()
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      this.toggle()
    }
  }
}
