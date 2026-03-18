// ValFormElement — form-associated base class for val-input, val-select, etc.
// Extends ValElement with form participation via ElementInternals.
// Always uses Shadow DOM. static formAssociated = true.

import { ValElement } from './val-element.js'

export abstract class ValFormElement extends ValElement {
  static formAssociated = true as const

  // internals is guaranteed non-null — form elements always use Shadow DOM
  protected declare readonly internals: ElementInternals

  constructor () {
    super({ shadow: true })
  }

  // --- Form API (via ElementInternals) ---

  get form (): HTMLFormElement | null {
    return this.internals.form
  }

  get name (): string {
    return this.getAttribute('name') ?? ''
  }

  get validity (): ValidityState {
    return this.internals.validity
  }

  get validationMessage (): string {
    return this.internals.validationMessage
  }

  abstract get value (): string
  abstract set value (v: string)

  protected setFormValue (value: string): void {
    this.internals.setFormValue(value)
  }

  protected setValidity (flags: ValidityStateFlags, message: string, anchor?: HTMLElement): void {
    if (anchor !== undefined) {
      this.internals.setValidity(flags, message, anchor)
    } else {
      this.internals.setValidity(flags, message)
    }
  }

  protected clearValidity (): void {
    this.internals.setValidity({})
  }

  checkValidity (): boolean {
    return this.internals.checkValidity()
  }

  reportValidity (): boolean {
    return this.internals.reportValidity()
  }

  // --- Form Lifecycle Callbacks ---

  formResetCallback (): void {
    // Subclasses override to reset to default value
  }

  formDisabledCallback (_disabled: boolean): void {
    // Subclasses override to handle disabled state
  }
}
