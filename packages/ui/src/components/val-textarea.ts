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
  textarea {
    box-sizing: border-box;
    width: 100%;
    padding: var(--val-space-2) var(--val-space-3);
    border: 1px solid var(--val-color-border);
    border-radius: var(--val-radius-md);
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    line-height: var(--val-leading-normal);
    color: var(--val-color-text);
    background: var(--val-color-bg-elevated);
    outline: none;
    resize: vertical;
    min-height: 5rem;
    transition: border-color var(--val-duration-fast) var(--val-ease-in-out),
                box-shadow var(--val-duration-fast) var(--val-ease-in-out);
  }
  textarea:focus { border-color: var(--val-color-border-focus); box-shadow: var(--val-focus-ring); }
  textarea::placeholder { color: var(--val-color-text-muted); }
  :host([aria-invalid="true"]) textarea { border-color: var(--val-color-error); }
  textarea:disabled { cursor: not-allowed; }
  textarea:autofill,
  textarea:-webkit-autofill {
    -webkit-box-shadow: 0 0 0 1000px var(--val-color-bg-elevated) inset;
    box-shadow: 0 0 0 1000px var(--val-color-bg-elevated) inset;
    -webkit-text-fill-color: var(--val-color-text);
    caret-color: var(--val-color-text);
    border-color: var(--val-color-border);
  }
  :host([autoresize]) textarea { resize: none; overflow: hidden; }
</style>
<div class="wrapper">
  <label part="label"><slot name="label"></slot></label>
  <textarea part="textarea"></textarea>
</div>
`

const SYNCED_ATTRS = ['placeholder', 'required', 'maxlength', 'rows', 'readonly'] as const

export class ValTextarea extends ValFormElement {
  static observedAttributes = ['disabled', 'value', 'autoresize', ...SYNCED_ATTRS]

  private textareaEl: HTMLTextAreaElement | null = null
  private defaultValue = ''

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  get value (): string {
    return this.textareaEl?.value ?? ''
  }

  set value (v: string) {
    if (this.textareaEl !== null) {
      this.textareaEl.value = v
      if (this.hasAttribute('autoresize')) this.autoResize()
    }
    this.setFormValue(v)
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.textareaEl === null) {
      this.textareaEl = this.shadowRoot!.querySelector('textarea')!
      this.defaultValue = this.getAttribute('value') ?? ''
      this.textareaEl.value = this.defaultValue
      for (const attr of SYNCED_ATTRS) {
        const val = this.getAttribute(attr)
        if (val !== null) this.textareaEl.setAttribute(attr, val)
      }
      this.syncDisabled()
    }
    this.textareaEl.addEventListener('input', this.handleInput)
    this.textareaEl.addEventListener('change', this.handleChange)
    this.textareaEl.addEventListener('focus', this.handleFocus)
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.textareaEl?.removeEventListener('input', this.handleInput)
    this.textareaEl?.removeEventListener('change', this.handleChange)
    this.textareaEl?.removeEventListener('focus', this.handleFocus)
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (this.textareaEl === null) return
    if (name === 'disabled') {
      this.syncDisabled()
    } else if (name === 'value') {
      if (val !== null) this.textareaEl.value = val
    } else if ((SYNCED_ATTRS as readonly string[]).includes(name)) {
      if (val !== null) {
        this.textareaEl.setAttribute(name, val)
      } else {
        this.textareaEl.removeAttribute(name)
      }
    }
  }

  formResetCallback (): void {
    if (this.textareaEl !== null) {
      this.textareaEl.value = this.defaultValue
      if (this.hasAttribute('autoresize')) this.autoResize()
    }
    this.setFormValue(this.defaultValue)
    this.clearValidity()
  }

  formDisabledCallback (disabled: boolean): void {
    if (this.textareaEl !== null) this.textareaEl.disabled = disabled
  }

  private syncDisabled (): void {
    if (this.textareaEl !== null) this.textareaEl.disabled = this.hasAttribute('disabled')
  }

  private autoResize (): void {
    if (this.textareaEl === null) return
    this.textareaEl.style.height = 'auto'
    this.textareaEl.style.height = this.textareaEl.scrollHeight + 'px'
  }

  private handleInput = (): void => {
    const val = this.textareaEl!.value
    this.setFormValue(val)
    if (this.hasAttribute('autoresize')) this.autoResize()
    this.emitInteraction('input', { value: val })
  }

  private handleChange = (): void => {
    this.emitInteraction('change', { value: this.textareaEl!.value })
  }

  private handleFocus = (): void => {
    this.emitInteraction('focus')
  }
}
