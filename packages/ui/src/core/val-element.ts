// ValElement — protocol base class for all val-* Web Components.
// Four pillars: telemetry (interaction events), CMS traceability (data-cms-id),
// i18n (locale observer), ARIA (ElementInternals).
// Fifth concern: declarative hydration directives (hydrate:idle, hydrate:visible,
// hydrate:media, hydrate:load).

import { localeObserver } from './locale-observer.js'
import { themeManager } from '../tokens/theme-manager.js'
import type { LocaleSubscriber } from './locale-observer.js'
import { emitInteraction } from './interaction-emitter.js'
import type { EntityStore, EntityData } from '../entity-store.js'

export interface ValElementInit {
  shadow?: boolean
}

type HydrationState = 'none' | 'pending' | 'complete'

type HydrationDirective =
  | { type: 'idle' }
  | { type: 'visible' }
  | { type: 'load' }
  | { type: 'media'; value: string }

interface EntityWatchRegistration {
  readonly store: EntityStore
  readonly id: string
  readonly callback: (entity: EntityData) => void
}

export abstract class ValElement extends HTMLElement implements LocaleSubscriber {
  protected readonly internals: ElementInternals | null
  private _templateCloned = false
  private _hydrationState: HydrationState = 'none'
  private _hydrationCleanup: (() => void) | null = null
  private _entityCleanups: Array<() => void> = []
  private _entityWatches: EntityWatchRegistration[] = []

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

  // --- Hydration ---

  get hydrated (): boolean {
    return this._hydrationState !== 'pending'
  }

  private _getHydrationDirective (): HydrationDirective | null {
    if (this.hasAttribute('hydrate:idle')) return { type: 'idle' }
    if (this.hasAttribute('hydrate:visible')) return { type: 'visible' }
    if (this.hasAttribute('hydrate:media')) {
      return { type: 'media', value: this.getAttribute('hydrate:media')! }
    }
    if (this.hasAttribute('hydrate:load')) return { type: 'load' }
    return null
  }

  private _scheduleHydration (directive: HydrationDirective): void {
    switch (directive.type) {
      case 'idle': {
        const id = requestIdleCallback(() => {
          this._hydrationCleanup = null
          this.connectedCallback()
        })
        this._hydrationCleanup = () => cancelIdleCallback(id)
        break
      }
      case 'visible': {
        const observer = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              observer.disconnect()
              this._hydrationCleanup = null
              this.connectedCallback()
              break
            }
          }
        })
        observer.observe(this)
        this._hydrationCleanup = () => observer.disconnect()
        break
      }
      case 'media': {
        const mql = matchMedia(directive.value)
        if (mql.matches) {
          this._hydrationCleanup = null
          this.connectedCallback()
          return
        }
        const handler = (e: MediaQueryListEvent): void => {
          if (e.matches) {
            mql.removeEventListener('change', handler)
            this._hydrationCleanup = null
            this.connectedCallback()
          }
        }
        mql.addEventListener('change', handler)
        this._hydrationCleanup = () => mql.removeEventListener('change', handler)
        break
      }
      // 'load' is handled in connectedCallback gate (falls through)
    }
  }

  // --- Entity Store ---

  protected watchEntity (store: EntityStore, id: string, callback: (entity: EntityData) => void): void {
    this._entityWatches.push({ store, id, callback })
    const unsub = store.subscribe(id, callback)
    this._entityCleanups.push(unsub)
  }

  // --- Lifecycle ---

  connectedCallback (): void {
    // --- Hydration gate ---
    if (this._hydrationState === 'none') {
      const directive = this._getHydrationDirective()
      if (directive !== null && directive.type !== 'load') {
        this._hydrationState = 'pending'
        this._scheduleHydration(directive)
        return
      }
    }

    if (this._hydrationState === 'pending') {
      this._hydrationState = 'complete'
    }

    // --- Normal path ---
    if (!this._templateCloned) {
      const template = this.createTemplate()
      const target = this.shadowRoot ?? this
      target.appendChild(template.content.cloneNode(true))
      this._templateCloned = true
    }
    localeObserver.subscribe(this)
    if (this.shadowRoot !== null) {
      themeManager.subscribe(this.shadowRoot)
    }

    // Re-subscribe entity watchers from previous connection
    if (this._entityWatches.length > 0 && this._entityCleanups.length === 0) {
      for (const reg of this._entityWatches) {
        const unsub = reg.store.subscribe(reg.id, reg.callback)
        this._entityCleanups.push(unsub)
      }
    }
  }

  disconnectedCallback (): void {
    if (this._hydrationCleanup !== null) {
      this._hydrationCleanup()
      this._hydrationCleanup = null
    }
    if (this.shadowRoot !== null) {
      themeManager.unsubscribe(this.shadowRoot)
    }
    localeObserver.unsubscribe(this)

    // Clean up entity store subscriptions
    for (const cleanup of this._entityCleanups) {
      cleanup()
    }
    this._entityCleanups = []
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
