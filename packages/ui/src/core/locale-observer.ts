// Singleton MutationObserver on <html lang>.
// All ValElements subscribe in connectedCallback, unsubscribe in disconnectedCallback.

export interface LocaleSubscriber {
  localeChanged (locale: string): void
}

function resolveLocale (): string {
  if (typeof document === 'undefined') return 'en'
  return document.documentElement.lang || 'en'
}

export class LocaleObserverImpl {
  private readonly subscribers = new Set<LocaleSubscriber>()
  private observer: MutationObserver | null = null
  private lastLocale: string = resolveLocale()

  get locale (): string {
    return resolveLocale()
  }

  subscribe (sub: LocaleSubscriber): void {
    this.subscribers.add(sub)
    if (this.subscribers.size === 1) {
      this.startObserving()
    }
  }

  unsubscribe (sub: LocaleSubscriber): void {
    this.subscribers.delete(sub)
    if (this.subscribers.size === 0) {
      this.stopObserving()
    }
  }

  private startObserving (): void {
    if (typeof document === 'undefined') return
    this.lastLocale = resolveLocale()
    this.observer = new MutationObserver(() => {
      const newLocale = resolveLocale()
      if (newLocale === this.lastLocale) return
      this.lastLocale = newLocale
      for (const sub of this.subscribers) {
        sub.localeChanged(newLocale)
      }
    })
    this.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['lang']
    })
  }

  private stopObserving (): void {
    if (this.observer !== null) {
      this.observer.disconnect()
      this.observer = null
    }
  }

  /** Test-only: disconnect observer and clear all subscribers. */
  _reset (): void {
    this.stopObserving()
    this.subscribers.clear()
    this.lastLocale = resolveLocale()
  }
}

export const localeObserver = new LocaleObserverImpl()
