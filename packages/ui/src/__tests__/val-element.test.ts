import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValElement } from '../core/val-element.js'
import { defineTestElement, flushObservers } from './test-helpers.js'

// --- Concrete test subclasses ---

class ShadowTestElement extends ValElement {
  protected createTemplate (): HTMLTemplateElement {
    const t = document.createElement('template')
    t.innerHTML = '<span class="inner">shadow content</span>'
    return t
  }
}

class LightTestElement extends ValElement {
  constructor () {
    super({ shadow: false })
  }

  protected createTemplate (): HTMLTemplateElement {
    const t = document.createElement('template')
    t.innerHTML = '<span class="inner">light content</span>'
    return t
  }
}

describe('ValElement', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  describe('Shadow DOM mode (default)', () => {
    it('attaches a shadow root', () => {
      const tag = defineTestElement('val-shadow', ShadowTestElement)
      const el = document.createElement(tag)
      expect(el.shadowRoot).not.toBeNull()
    })

    it('clones template into shadow root on connect', () => {
      const tag = defineTestElement('val-shadow-tpl', ShadowTestElement)
      const el = document.createElement(tag)
      container.appendChild(el)

      const inner = el.shadowRoot!.querySelector('.inner')
      expect(inner).not.toBeNull()
      expect(inner!.textContent).toBe('shadow content')
    })

    it('has non-null internals', () => {
      const tag = defineTestElement('val-shadow-int', ShadowTestElement)
      const el = document.createElement(tag) as ShadowTestElement
      // internals is protected — access via the test subclass
      expect((el as InstanceType<typeof ShadowTestElement> & { internals: ElementInternals | null }).internals).not.toBeNull()
    })
  })

  describe('Light DOM mode', () => {
    it('does not attach a shadow root', () => {
      const tag = defineTestElement('val-light', LightTestElement)
      const el = document.createElement(tag)
      expect(el.shadowRoot).toBeNull()
    })

    it('clones template into this (light DOM) on connect', () => {
      const tag = defineTestElement('val-light-tpl', LightTestElement)
      const el = document.createElement(tag)
      container.appendChild(el)

      const inner = el.querySelector('.inner')
      expect(inner).not.toBeNull()
      expect(inner!.textContent).toBe('light content')
    })

    it('has null internals', () => {
      const tag = defineTestElement('val-light-int', LightTestElement)
      const el = document.createElement(tag) as LightTestElement
      expect((el as InstanceType<typeof LightTestElement> & { internals: ElementInternals | null }).internals).toBeNull()
    })
  })

  describe('Pillar 1: Telemetry', () => {
    it('emitInteraction dispatches val:interaction CustomEvent', () => {
      const tag = defineTestElement('val-telem', ShadowTestElement)
      const el = document.createElement(tag) as ShadowTestElement
      container.appendChild(el)

      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      // Call the protected method via type assertion
      ;(el as ShadowTestElement & { emitInteraction: (a: string) => void }).emitInteraction('click')

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('click')
      expect(detail.component).toBe(tag.toUpperCase())
    })

    it('emitInteraction includes extra detail', () => {
      const tag = defineTestElement('val-telem-detail', ShadowTestElement)
      const el = document.createElement(tag)
      container.appendChild(el)

      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      ;(el as ShadowTestElement & { emitInteraction: (a: string, d: Record<string, string | number | boolean>) => void })
        .emitInteraction('change', { field: 'name' })

      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.field).toBe('name')
    })
  })

  describe('Pillar 2: CMS Traceability', () => {
    it('returns null when data-cms-id is absent', () => {
      const tag = defineTestElement('val-cms-no', ShadowTestElement)
      const el = document.createElement(tag)
      expect(el.cmsId).toBeNull()
    })

    it('reads data-cms-id attribute', () => {
      const tag = defineTestElement('val-cms-yes', ShadowTestElement)
      const el = document.createElement(tag)
      el.setAttribute('data-cms-id', 'hero-section')
      expect(el.cmsId).toBe('hero-section')
    })
  })

  describe('Pillar 3: i18n', () => {
    let originalLang: string

    beforeEach(() => {
      originalLang = document.documentElement.lang
      document.documentElement.lang = 'en'
    })

    afterEach(() => {
      document.documentElement.lang = originalLang
    })

    it('exposes current locale', () => {
      const tag = defineTestElement('val-i18n-get', ShadowTestElement)
      const el = document.createElement(tag)
      container.appendChild(el)

      document.documentElement.lang = 'fr'
      expect((el as ShadowTestElement & { locale: string }).locale).toBe('fr')
    })

    it('calls localeChanged when html[lang] changes', async () => {
      const tag = defineTestElement('val-i18n-cb', ShadowTestElement)
      const el = document.createElement(tag) as ShadowTestElement
      const spy = vi.spyOn(el, 'localeChanged')
      container.appendChild(el)

      document.documentElement.lang = 'ja'
      await flushObservers()

      expect(spy).toHaveBeenCalledWith('ja')
    })

    it('unsubscribes from locale observer on disconnect', async () => {
      const tag = defineTestElement('val-i18n-dc', ShadowTestElement)
      const el = document.createElement(tag) as ShadowTestElement
      const spy = vi.spyOn(el, 'localeChanged')
      container.appendChild(el)
      el.remove()

      document.documentElement.lang = 'de'
      await flushObservers()

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('Lifecycle', () => {
    it('calls attributeChangedCallback for observed attributes', () => {
      class ObservedElement extends ValElement {
        static observedAttributes = ['variant']
        changes: Array<{ name: string, old: string | null, val: string | null }> = []

        protected createTemplate (): HTMLTemplateElement {
          return document.createElement('template')
        }

        attributeChangedCallback (name: string, old: string | null, val: string | null): void {
          this.changes.push({ name, old, val })
        }
      }

      const tag = defineTestElement('val-observed', ObservedElement)
      const el = document.createElement(tag) as ObservedElement
      container.appendChild(el)

      el.setAttribute('variant', 'primary')
      expect(el.changes).toHaveLength(1)
      expect(el.changes[0]).toEqual({ name: 'variant', old: null, val: 'primary' })
    })
  })
})
