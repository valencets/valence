import { ValElement } from '../core/val-element.js'

export interface ValSubmitDetail {
  data: Record<string, string>
}

export class ValForm extends ValElement {
  static observedAttributes = ['disabled']

  private initialized = false

  constructor () {
    super({ shadow: false })
  }

  protected createTemplate (): HTMLTemplateElement {
    return document.createElement('template')
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (!this.initialized) {
      this.setAttribute('role', 'form')
      this.initialized = true
    }
    this.addEventListener('click', this.handleClick)
    this.addEventListener('keydown', this.handleKeydown)
  }

  disconnectedCallback (): void {
    super.disconnectedCallback()
    this.removeEventListener('click', this.handleClick)
    this.removeEventListener('keydown', this.handleKeydown)
  }

  /** Validate all form-associated children. Returns true if all valid. */
  validate (): boolean {
    let allValid = true
    for (const child of this.getFormElements()) {
      if (typeof child.checkValidity === 'function' && !child.checkValidity()) {
        allValid = false
      }
    }
    return allValid
  }

  /** Collect name/value pairs from all form-associated children. */
  collectData (): Record<string, string> {
    const data: Record<string, string> = {}
    for (const child of this.getFormElements()) {
      const name = child.getAttribute('name')
      if (name !== null && name !== '' && 'value' in child) {
        data[name] = String((child as HTMLElement & { value: string }).value)
      }
    }
    return data
  }

  /** Programmatic submit. Validates first. */
  submit (): void {
    this.attemptSubmit()
  }

  /** Reset all form-associated children. */
  reset (): void {
    for (const child of this.getFormElements()) {
      if (typeof child.formResetCallback === 'function') {
        child.formResetCallback()
      }
    }
    this.emitInteraction('reset')
  }

  private getFormElements (): Array<HTMLElement & { checkValidity?: () => boolean, formResetCallback?: () => void }> {
    // Only collect elements that belong to THIS form — exclude those inside nested forms
    const all = Array.from(this.querySelectorAll('[name]')) as Array<HTMLElement & { checkValidity?: () => boolean, formResetCallback?: () => void }>
    return all.filter(el => el.closest('[role="form"]') === this)
  }

  private attemptSubmit (): void {
    if (this.hasAttribute('disabled')) return

    if (!this.validate()) {
      this.dispatchEvent(new CustomEvent('val:invalid', { bubbles: true, composed: true }))
      return
    }

    const data = this.collectData()
    this.dispatchEvent(new CustomEvent<ValSubmitDetail>('val:submit', {
      bubbles: true,
      composed: true,
      detail: { data }
    }))
    this.emitInteraction('submit')
  }

  private handleClick = (e: Event): void => {
    const target = e.target as HTMLElement
    // Check if a submit-type button was clicked
    if (target.closest('[type="submit"]') !== null) {
      e.preventDefault()
      this.attemptSubmit()
    }
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    // Enter in an input-like element triggers submit
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement
      const tag = target.tagName.toLowerCase()
      if (tag === 'input' || tag === 'val-input') {
        e.preventDefault()
        this.attemptSubmit()
      }
    }
  }
}
