// ValElement — protocol base class for all val-* Web Components.
// Four pillars: telemetry (interaction events), CMS traceability (data-cms-id),
// i18n (locale observer), ARIA (ElementInternals).

import { localeObserver } from './locale-observer.js'
import type { LocaleSubscriber } from './locale-observer.js'
import { emitInteraction } from './interaction-emitter.js'

export interface ValElementInit {
  shadow?: boolean
}

export abstract class ValElement extends HTMLElement implements LocaleSubscriber {
  protected readonly internals: ElementInternals | null

  constructor (init?: ValElementInit) {
    super()
    const useShadow = init?.shadow !== false
    if (useShadow) {
      this.attachShadow({ mode: 'open' })
      this.internals = this.attachInternals()
    } else {
      this.internals = null
    }
  }

  // --- Template ---
  // Subclass returns a <template>. Cloned once in connectedCallback.
  protected abstract createTemplate (): HTMLTemplateElement

  // --- Lifecycle ---

  connectedCallback (): void {
    const template = this.createTemplate()
    const target = this.shadowRoot ?? this
    target.appendChild(template.content.cloneNode(true))
    localeObserver.subscribe(this)
  }

  disconnectedCallback (): void {
    localeObserver.unsubscribe(this)
  }

  attributeChangedCallback (_name: string, _old: string | null, _val: string | null): void {
    // Subclasses override as needed
  }

  // --- Pillar 1: Telemetry ---
  // Always dispatches. If nobody listens, events vanish.
  protected emitInteraction (action: string, detail?: Record<string, string | number | boolean>): void {
    emitInteraction(this, action, detail)
  }

  // --- Pillar 2: CMS Traceability ---
  // CMS stamps data-cms-id at render time. We just read it.
  get cmsId (): string | null {
    return this.getAttribute('data-cms-id')
  }

  // --- Pillar 3: i18n ---
  protected get locale (): string {
    return localeObserver.locale
  }

  localeChanged (_newLocale: string): void {
    // Subclasses override to react to locale changes
  }
}
