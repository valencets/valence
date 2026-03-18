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
      get form () { return element.closest('form') },
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

// --- requestIdleCallback polyfill for happy-dom ---
if (typeof globalThis.requestIdleCallback !== 'function') {
  globalThis.requestIdleCallback = function (cb: IdleRequestCallback): number {
    return setTimeout(() => {
      cb({ didTimeout: false, timeRemaining: () => 50 } as IdleDeadline)
    }, 0) as unknown as number
  } as typeof requestIdleCallback
  globalThis.cancelIdleCallback = function (id: number): void {
    clearTimeout(id)
  }
}

// --- IntersectionObserver polyfill for happy-dom ---
if (typeof globalThis.IntersectionObserver !== 'function') {
  globalThis.IntersectionObserver = class MockIntersectionObserver {
    private _callback: IntersectionObserverCallback
    private _elements = new Set<Element>()
    readonly root: Element | Document | null = null
    readonly rootMargin: string = '0px'
    readonly thresholds: ReadonlyArray<number> = [0]

    constructor (callback: IntersectionObserverCallback) {
      this._callback = callback
    }

    observe (target: Element): void { this._elements.add(target) }
    unobserve (target: Element): void { this._elements.delete(target) }
    disconnect (): void { this._elements.clear() }
    takeRecords (): IntersectionObserverEntry[] { return [] }

    /** Test helper — simulate an intersection entry */
    _trigger (entries: Array<Partial<IntersectionObserverEntry>>): void {
      this._callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver)
    }
  } as unknown as typeof IntersectionObserver
}

// --- matchMedia polyfill for happy-dom ---
if (typeof globalThis.matchMedia !== 'function') {
  globalThis.matchMedia = function (query: string): MediaQueryList {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    } as MediaQueryList
  }
}
