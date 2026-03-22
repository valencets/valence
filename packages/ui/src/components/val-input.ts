import { ValFormElement } from '../core/val-form-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: block; }
  :host([disabled]) { opacity: 0.5; }
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--val-space-1);
  }
  label {
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    font-weight: var(--val-weight-medium);
    color: var(--val-color-text);
  }
  .input-row {
    position: relative;
  }
  .icon-slot {
    position: absolute;
    left: var(--val-space-3);
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--val-color-text-muted);
    pointer-events: none;
    z-index: 1;
  }
  ::slotted([slot="icon"]) {
    display: block;
  }
  :host(:not([has-icon])) .icon-slot { display: none; }
  input {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 2.5rem;
    padding: var(--val-space-2) var(--val-space-3);
    border: 1px solid var(--val-color-border);
    border-radius: var(--val-radius-md);
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    line-height: var(--val-leading-normal);
    color: var(--val-color-text);
    background: var(--val-color-bg-elevated);
    outline: none;
    transition: border-color var(--val-duration-fast) var(--val-ease-in-out),
                box-shadow var(--val-duration-fast) var(--val-ease-in-out);
  }
  :host([has-icon]) input { padding-left: 2.75rem; }
  :host([size="lg"]) input { height: 3rem; font-size: var(--val-text-base); }
  :host([size="sm"]) input { height: 2rem; font-size: var(--val-text-xs); }
  input:focus { border-color: var(--val-color-border-focus); box-shadow: var(--val-focus-ring); }
  input::placeholder { color: var(--val-color-text-muted); }
  :host([aria-invalid="true"]) input { border-color: var(--val-color-error); }
  input:disabled { cursor: not-allowed; }
</style>
<div class="wrapper">
  <label part="label"><slot name="label"></slot></label>
  <div class="input-row">
    <span class="icon-slot"><slot name="icon"></slot></span>
    <input part="input" />
  </div>
</div>
`

const SYNCED_ATTRS = ['type', 'placeholder', 'required', 'pattern', 'minlength', 'maxlength', 'min', 'max', 'step', 'readonly', 'autocomplete'] as const

export class ValInput extends ValFormElement {
  static observedAttributes = ['disabled', 'value', ...SYNCED_ATTRS]

  private inputEl: HTMLInputElement | null = null
  private defaultValue = ''

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  get value (): string {
    return this.inputEl?.value ?? ''
  }

  set value (v: string) {
    if (this.inputEl !== null) this.inputEl.value = v
    this.setFormValue(v)
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.inputEl === null) {
      this.inputEl = this.shadowRoot!.querySelector('input')!
      this.defaultValue = this.getAttribute('value') ?? ''
      this.inputEl.value = this.defaultValue
      this.setFormValue(this.defaultValue)
      // Sync initial attributes to inner input
      for (const attr of SYNCED_ATTRS) {
        const val = this.getAttribute(attr)
        if (val !== null) this.inputEl.setAttribute(attr, val)
      }
      this.syncDisabled()
      this.syncAriaLabel()
      this.syncIconSlot()
    }
    this.inputEl.addEventListener('input', this.handleInput)
    this.inputEl.addEventListener('change', this.handleChange)
    this.inputEl.addEventListener('focus', this.handleFocus)
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.inputEl?.removeEventListener('input', this.handleInput)
    this.inputEl?.removeEventListener('change', this.handleChange)
    this.inputEl?.removeEventListener('focus', this.handleFocus)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (this.inputEl === null) return
    if (name === 'disabled') {
      this.syncDisabled()
    } else if (name === 'value') {
      if (val !== null) this.inputEl.value = val
      this.syncValidity()
    } else if ((SYNCED_ATTRS as readonly string[]).includes(name)) {
      if (val !== null) {
        this.inputEl.setAttribute(name, val)
      } else {
        this.inputEl.removeAttribute(name)
      }
      this.syncValidity()
    }
  }

  formResetCallback (): void {
    if (this.inputEl !== null) this.inputEl.value = this.defaultValue
    this.setFormValue(this.defaultValue)
    this.clearValidity()
  }

  formDisabledCallback (disabled: boolean): void {
    if (this.inputEl !== null) this.inputEl.disabled = disabled
  }

  private syncIconSlot (): void {
    const iconSlot = this.shadowRoot?.querySelector('slot[name="icon"]') as HTMLSlotElement | null
    if (iconSlot !== null && iconSlot.assignedNodes().length > 0) {
      this.setAttribute('has-icon', '')
    }
  }

  private syncAriaLabel (): void {
    const labelSlot = this.shadowRoot?.querySelector('slot[name="label"]') as HTMLSlotElement | null
    if (labelSlot !== null) {
      const assigned = labelSlot.assignedNodes()
      const text = assigned.map(n => n.textContent ?? '').join('').trim()
      if (text) {
        this.internals.ariaLabel = text
        this.inputEl?.setAttribute('aria-label', text)
      }
    }
  }

  private syncDisabled (): void {
    const disabled = this.hasAttribute('disabled')
    if (this.inputEl !== null) this.inputEl.disabled = disabled
  }

  private syncValidity (): void {
    if (this.inputEl === null) return
    if (this.inputEl.validity.valid) {
      this.clearValidity()
    } else {
      this.setValidity(
        { customError: true },
        this.inputEl.validationMessage,
        this.inputEl
      )
    }
  }

  private handleInput = (): void => {
    const val = this.inputEl!.value
    this.setFormValue(val)
    this.syncValidity()
    this.emitInteraction('input', { value: val })
  }

  private handleChange = (): void => {
    this.emitInteraction('change', { value: this.inputEl!.value })
  }

  private handleFocus = (): void => {
    this.emitInteraction('focus')
  }
}
