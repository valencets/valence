let idCounter = 0

export class TrackingForm extends HTMLElement {
  static observedAttributes = ['type', 'target', 'persist']

  private handleSubmit: ((event: Event) => void) | null = null

  connectedCallback (): void {
    const type = this.getAttribute('type') ?? 'FORM_INPUT'
    this.setAttribute('data-telemetry-type', type)

    const target = this.getAttribute('target')
    if (target !== null) {
      this.setAttribute('data-telemetry-target', target)
    }

    if (this.hasAttribute('persist')) {
      this.setAttribute('data-inertia-persist', '')
      if (this.id === '') {
        this.id = `inertia-form-${String(idCounter++)}`
      }
    }

    this.handleSubmit = (_event: Event): void => {
      const detail = {
        target: this.getAttribute('target') ?? '',
        type: this.getAttribute('data-telemetry-type') ?? 'FORM_INPUT'
      }
      this.dispatchEvent(new CustomEvent('inertia:form-submit', {
        bubbles: true,
        detail
      }))
    }

    this.addEventListener('submit', this.handleSubmit)
  }

  disconnectedCallback (): void {
    if (this.handleSubmit !== null) {
      this.removeEventListener('submit', this.handleSubmit)
      this.handleSubmit = null
    }
  }

  connectedMoveCallback (): void {
    // Intentional no-op — multi-step form state preserved by moveBefore()
  }

  attributeChangedCallback (name: string, _oldValue: string | null, newValue: string | null): void {
    const attrMap: Record<string, string> = {
      type: 'data-telemetry-type',
      target: 'data-telemetry-target'
    }

    const mapped = attrMap[name]
    if (mapped !== undefined) {
      if (newValue !== null) {
        this.setAttribute(mapped, newValue)
      } else {
        this.removeAttribute(mapped)
      }
      return
    }

    if (name === 'persist') {
      if (newValue !== null) {
        this.setAttribute('data-inertia-persist', '')
        if (this.id === '') {
          this.id = `inertia-form-${String(idCounter++)}`
        }
      } else {
        this.removeAttribute('data-inertia-persist')
      }
    }
  }
}

customElements.define('inertia-form', TrackingForm)
