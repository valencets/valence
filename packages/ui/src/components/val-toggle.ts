import { ValFormElement } from '../core/val-form-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: inline-flex; align-items: center; gap: var(--val-space-2); cursor: pointer; }
  :host([disabled]) { opacity: 0.5; pointer-events: none; }
  .track {
    position: relative;
    width: 2.5rem;
    height: 1.375rem;
    border-radius: var(--val-radius-full);
    background: var(--val-color-border);
    transition: background var(--val-duration-fast) var(--val-ease-in-out);
    flex-shrink: 0;
  }
  .track:focus-visible { box-shadow: var(--val-focus-ring); }
  .track[aria-checked="true"] { background: var(--val-color-primary); }
  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 1.125rem;
    height: 1.125rem;
    border-radius: var(--val-radius-full);
    background: var(--val-color-bg-elevated);
    box-shadow: var(--val-shadow-sm);
    transition: left var(--val-duration-fast) var(--val-ease-in-out);
  }
  .track[aria-checked="true"] .thumb { left: calc(100% - 1.125rem - 2px); }
  .label {
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    color: var(--val-color-text);
    user-select: none;
  }
</style>
<div class="track" role="switch" aria-checked="false" tabindex="0" part="track">
  <div class="thumb"></div>
</div>
<span class="label" part="label"><slot></slot></span>
`

export class ValToggle extends ValFormElement {
  static observedAttributes = ['checked', 'disabled']

  private trackEl: HTMLElement | null = null
  private checked = false

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  get value (): string {
    return this.checked ? (this.getAttribute('value') ?? 'on') : ''
  }

  set value (_v: string) {
    // Toggle value controlled by checked state
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.trackEl === null) {
      this.trackEl = this.shadowRoot!.querySelector('.track')!
    }
    this.checked = this.hasAttribute('checked')
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
      this.syncState()
    } else if (name === 'disabled' && this.trackEl !== null) {
      this.trackEl.setAttribute('tabindex', val !== null ? '-1' : '0')
    }
  }

  formResetCallback (): void {
    this.checked = false
    this.syncState()
    this.setFormValue('')
    this.clearValidity()
  }

  formDisabledCallback (disabled: boolean): void {
    if (this.trackEl !== null) {
      this.trackEl.setAttribute('tabindex', disabled ? '-1' : '0')
    }
  }

  private syncState (): void {
    if (this.trackEl === null) return
    this.trackEl.setAttribute('aria-checked', String(this.checked))
    this.setFormValue(this.checked ? (this.getAttribute('value') ?? 'on') : '')
  }

  private toggle (): void {
    if (this.hasAttribute('disabled')) return
    this.checked = !this.checked
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
