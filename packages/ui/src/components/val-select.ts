import { ValFormElement } from '../core/val-form-element.js'

const template = document.createElement('template')
template.innerHTML = `
<style>
  :host { display: block; position: relative; }
  :host([disabled]) { opacity: 0.5; pointer-events: none; }
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
  .trigger {
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
    cursor: pointer;
    text-align: left;
    outline: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .trigger:focus { border-color: var(--val-color-border-focus); box-shadow: var(--val-focus-ring); }
  .trigger::after { content: "\\25BE"; margin-left: var(--val-space-2); }
  .listbox {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 10;
    margin-top: var(--val-space-1);
    padding: var(--val-space-1) 0;
    border: 1px solid var(--val-color-border);
    border-radius: var(--val-radius-md);
    background: var(--val-color-bg-elevated);
    box-shadow: var(--val-shadow-md);
    max-height: 15rem;
    overflow-y: auto;
  }
  :host([open]) .listbox { display: block; }
  .option {
    padding: var(--val-space-2) var(--val-space-3);
    font-family: var(--val-font-sans);
    font-size: var(--val-text-sm);
    color: var(--val-color-text);
    cursor: pointer;
  }
  .option:hover, .option[aria-selected="true"] {
    background: var(--val-color-bg-muted);
  }
  .option.focused {
    outline: 2px solid var(--val-color-border-focus);
    outline-offset: -2px;
  }
</style>
<div class="wrapper">
  <label part="label"><slot name="label"></slot></label>
  <button class="trigger" part="trigger" type="button"
    role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="listbox">
    <span class="trigger-text"></span>
  </button>
  <div class="listbox" role="listbox" part="listbox" id="listbox"></div>
</div>
`

interface OptionEntry {
  value: string
  label: string
}

const OPEN_KEYS: ReadonlySet<string> = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' '])

type SelectKeyAction = (self: ValSelect) => void

const SELECT_KEY_HANDLERS: Record<string, SelectKeyAction | undefined> = {
  ArrowDown: (self) => { self._moveFocus(1) },
  ArrowUp: (self) => { self._moveFocus(-1) },
  Enter: (self) => { self._confirmFocused() },
  ' ': (self) => { self._confirmFocused() },
  Escape: (self) => { self.close() }
}

export class ValSelect extends ValFormElement {
  static observedAttributes = ['disabled', 'required', 'placeholder']

  private triggerEl: HTMLButtonElement | null = null
  private listboxEl: HTMLElement | null = null
  private triggerTextEl: HTMLElement | null = null
  private options: OptionEntry[] = []
  private focusedIndex = -1
  private currentValue = ''
  private observer: MutationObserver | null = null

  protected createTemplate (): HTMLTemplateElement {
    return template
  }

  get value (): string {
    return this.currentValue
  }

  set value (v: string) {
    this.currentValue = v
    this.setFormValue(v)
    this.updateTriggerText()
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (this.triggerEl === null) {
      this.triggerEl = this.shadowRoot!.querySelector('.trigger')!
      this.listboxEl = this.shadowRoot!.querySelector('.listbox')!
      this.triggerTextEl = this.shadowRoot!.querySelector('.trigger-text')!
    }
    this.buildOptions()
    this.triggerEl.addEventListener('click', this.handleTriggerClick)
    this.triggerEl.addEventListener('keydown', this.handleKeydown)
    // Watch for light DOM <option> changes
    this.observer = new MutationObserver(() => this.buildOptions())
    this.observer.observe(this, { childList: true })
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.triggerEl?.removeEventListener('click', this.handleTriggerClick)
    this.triggerEl?.removeEventListener('keydown', this.handleKeydown)
    this.observer?.disconnect()
    this.observer = null
    this.close()
  }

  attributeChangedCallback (name: string, old: string | null, val: string | null): void {
    if (name === 'disabled' && this.triggerEl !== null) {
      this.triggerEl.disabled = this.hasAttribute('disabled')
    }
    if (name === 'placeholder') this.updateTriggerText()
  }

  formResetCallback (): void {
    this.currentValue = ''
    this.setFormValue('')
    this.clearValidity()
    this.updateTriggerText()
    this.renderOptions()
  }

  formDisabledCallback (disabled: boolean): void {
    if (this.triggerEl !== null) this.triggerEl.disabled = disabled
  }

  private buildOptions (): void {
    this.options = []
    for (const child of this.querySelectorAll('option')) {
      this.options.push({
        value: child.getAttribute('value') ?? child.textContent ?? '',
        label: child.textContent ?? ''
      })
    }
    this.renderOptions()
    this.updateTriggerText()
  }

  private renderOptions (): void {
    if (this.listboxEl === null) return
    this.listboxEl.innerHTML = ''
    for (let i = 0; i < this.options.length; i++) {
      const opt = this.options[i]!
      const div = document.createElement('div')
      div.className = 'option'
      div.id = `opt-${i}`
      div.setAttribute('role', 'option')
      div.setAttribute('aria-selected', String(opt.value === this.currentValue))
      div.dataset.value = opt.value
      div.textContent = opt.label
      div.addEventListener('click', () => this.selectOption(i))
      this.listboxEl.appendChild(div)
    }
  }

  private updateTriggerText (): void {
    if (this.triggerTextEl === null) return
    const selected = this.options.find(o => o.value === this.currentValue)
    this.triggerTextEl.textContent = selected?.label ?? this.getAttribute('placeholder') ?? ''
  }

  private open (): void {
    this.setAttribute('open', '')
    this.triggerEl!.setAttribute('aria-expanded', 'true')
    this.focusedIndex = this.options.findIndex(o => o.value === this.currentValue)
    this.updateFocusedOption()
    document.addEventListener('click', this.handleOutsideClick)
  }

  close (): void {
    this.removeAttribute('open')
    if (this.triggerEl !== null) this.triggerEl.setAttribute('aria-expanded', 'false')
    this.focusedIndex = -1
    this.updateFocusedOption()
    document.removeEventListener('click', this.handleOutsideClick)
  }

  private selectOption (index: number): void {
    const opt = this.options[index]
    if (opt === undefined) return
    this.currentValue = opt.value
    this.setFormValue(opt.value)
    this.renderOptions()
    this.updateTriggerText()
    this.close()
    this.triggerEl?.focus()
    this.emitInteraction('change', { value: opt.value })
  }

  private updateFocusedOption (): void {
    if (this.listboxEl === null) return
    const items = this.listboxEl.querySelectorAll('.option')
    for (let i = 0; i < items.length; i++) {
      items[i]!.classList.toggle('focused', i === this.focusedIndex)
    }
    if (this.triggerEl !== null) {
      if (this.focusedIndex >= 0) {
        this.triggerEl.setAttribute('aria-activedescendant', `opt-${this.focusedIndex}`)
      } else {
        this.triggerEl.removeAttribute('aria-activedescendant')
      }
    }
  }

  /** Move focus by delta (used by key handlers). */
  _moveFocus (delta: number): void {
    this.focusedIndex = Math.min(Math.max(this.focusedIndex + delta, 0), this.options.length - 1)
    this.updateFocusedOption()
  }

  /** Confirm currently focused option (used by key handlers). */
  _confirmFocused (): void {
    if (this.focusedIndex >= 0) this.selectOption(this.focusedIndex)
  }

  private handleTriggerClick = (): void => {
    if (this.hasAttribute('open')) {
      this.close()
    } else {
      this.open()
    }
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    if (!this.hasAttribute('open')) {
      if (OPEN_KEYS.has(e.key)) {
        e.preventDefault()
        this.open()
      }
      return
    }

    const handler = SELECT_KEY_HANDLERS[e.key]
    if (!handler) return
    e.preventDefault()
    handler(this)
  }

  private handleOutsideClick = (e: Event): void => {
    const target = e.target as Node | null
    if (target === null || (!this.contains(target) && !this.shadowRoot!.contains(target))) {
      this.close()
    }
  }
}

customElements.define('val-select', ValSelect)
