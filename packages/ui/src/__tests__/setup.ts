// Polyfill ElementInternals for happy-dom which does not support it.

interface MinimalElementInternals {
  form: HTMLFormElement | null
  validity: ValidityState
  validationMessage: string
  willValidate: boolean
  labels: NodeList
  shadowRoot: ShadowRoot | null

  setFormValue (value: FormData | string | null): void
  setValidity (flags?: ValidityStateFlags, message?: string, anchor?: HTMLElement): void
  checkValidity (): boolean
  reportValidity (): boolean
}

const defaultValidity: ValidityState = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valid: true,
  valueMissing: false
}

if (typeof HTMLElement.prototype.attachInternals !== 'function') {
  HTMLElement.prototype.attachInternals = function (): ElementInternals {
    const element = this
    let currentValidity = { ...defaultValidity }
    let currentMessage = ''
    const state = { formValue: null as FormData | string | null }

    const internals: MinimalElementInternals = {
      form: null,
      get validity () { return currentValidity },
      get validationMessage () { return currentMessage },
      willValidate: true,
      labels: document.querySelectorAll('[data-none]'),
      shadowRoot: element.shadowRoot,

      setFormValue (value: FormData | string | null) {
        state.formValue = value
      },

      setValidity (flags?: ValidityStateFlags, message?: string, _anchor?: HTMLElement) {
        if (flags === undefined || Object.keys(flags).length === 0) {
          currentValidity = { ...defaultValidity }
          currentMessage = ''
          return
        }
        currentValidity = { ...defaultValidity }
        let hasError = false
        for (const [key, val] of Object.entries(flags)) {
          if (val === true) {
            ;(currentValidity as Record<string, boolean>)[key] = true
            hasError = true
          }
        }
        currentValidity.valid = !hasError
        currentMessage = message ?? ''
      },

      checkValidity () {
        return currentValidity.valid
      },

      reportValidity () {
        return currentValidity.valid
      }
    }

    return internals as unknown as ElementInternals
  }
}
