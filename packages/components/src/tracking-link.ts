let idCounter = 0

export class TrackingLink extends HTMLElement {
  static observedAttributes = ['type', 'target', 'href', 'tel', 'persist']

  private anchor: HTMLAnchorElement | null = null

  connectedCallback (): void {
    this.anchor = this.querySelector('a')

    const tel = this.getAttribute('tel')
    const href = this.getAttribute('href')

    if (this.anchor === null && (href !== null || tel !== null)) {
      this.anchor = document.createElement('a')
      this.appendChild(this.anchor)
    }

    if (tel !== null) {
      this.setAttribute('data-telemetry-type', this.getAttribute('type') ?? 'INTENT_CALL')
      if (this.anchor !== null) {
        this.anchor.setAttribute('href', `tel:${tel}`)
        this.anchor.textContent = tel
      }
    } else {
      this.setAttribute('data-telemetry-type', this.getAttribute('type') ?? 'INTENT_NAVIGATE')
      if (href !== null && this.anchor !== null) {
        this.anchor.setAttribute('href', href)
      }
    }

    const target = this.getAttribute('target')
    if (target !== null) {
      this.setAttribute('data-telemetry-target', target)
    }

    if (this.hasAttribute('persist')) {
      this.setAttribute('data-inertia-persist', '')
      if (this.id === '') {
        this.id = `inertia-link-${String(idCounter++)}`
      }
    }
  }

  disconnectedCallback (): void {
    // Intentional no-op
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _oldValue: string | null, newValue: string | null): void {
    if (name === 'type') {
      if (newValue !== null) {
        this.setAttribute('data-telemetry-type', newValue)
      } else {
        this.removeAttribute('data-telemetry-type')
      }
      return
    }

    if (name === 'target') {
      if (newValue !== null) {
        this.setAttribute('data-telemetry-target', newValue)
      } else {
        this.removeAttribute('data-telemetry-target')
      }
      return
    }

    if (name === 'href') {
      if (this.anchor !== null && newValue !== null) {
        this.anchor.setAttribute('href', newValue)
      }
      return
    }

    if (name === 'tel') {
      if (newValue !== null) {
        this.setAttribute('data-telemetry-type', this.getAttribute('type') ?? 'INTENT_CALL')
        if (this.anchor === null) {
          this.anchor = document.createElement('a')
          this.appendChild(this.anchor)
        }
        this.anchor.setAttribute('href', `tel:${newValue}`)
        this.anchor.textContent = newValue
      }
      return
    }

    if (name === 'persist') {
      if (newValue !== null) {
        this.setAttribute('data-inertia-persist', '')
        if (this.id === '') {
          this.id = `inertia-link-${String(idCounter++)}`
        }
      } else {
        this.removeAttribute('data-inertia-persist')
      }
    }
  }
}

customElements.define('inertia-link', TrackingLink)
