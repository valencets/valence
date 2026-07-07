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
  private _checked = false

  /** Programmatic writes update state silently — only user toggles
   *  dispatch change, matching native checkbox semantics. */
  get checked (): boolean {
    return this._checked
  }

  set checked (next: boolean) {
    this._checked = next
    if (next) this.setAttribute('checked', '')
    else this.removeAttribute('checked')
    this.syncState()
  }

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  get value (): string {
    return this._checked ? (this.getAttribute('value') ?? 'on') : ''
  }

  set value (_v: string) {
    // Toggle value controlled by checked state
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.trackEl === null) {
      this.trackEl = this.shadowRoot!.querySelector('.track')!
    }
    this._checked = this.hasAttribute('checked')
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
      this._checked = val !== null
      this.syncState()
    } else if (name === 'disabled' && this.trackEl !== null) {
      this.trackEl.setAttribute('tabindex', val !== null ? '-1' : '0')
    }
  }

  formResetCallback (): void {
    this._checked = false
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
    this.trackEl.setAttribute('aria-checked', String(this._checked))
    this.setFormValue(this._checked ? (this.getAttribute('value') ?? 'on') : '')
  }

  private toggle (): void {
    if (this.hasAttribute('disabled')) return
    this._checked = !this._checked
    this.syncState()
    // Standard event contract first (binding layers, plain listeners),
    // telemetry second.
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }))
    this.emitInteraction('change', { checked: this._checked })
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
