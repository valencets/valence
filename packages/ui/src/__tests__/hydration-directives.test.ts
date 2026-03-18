import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ValElement } from '../core/val-element.js'
import { defineTestElement, flushObservers } from './test-helpers.js'

// Minimal test subclass — does not override connectedCallback
class HydrationTestEl extends ValElement {
  protected createTemplate (): HTMLTemplateElement {
    const t = document.createElement('template')
    t.innerHTML = '<span part="inner"><slot></slot></span>'
    return t
  }
}

describe('Hydration Directives', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  describe('hydrate:idle', () => {
    it('does not clone template immediately when hydrate:idle is set', () => {
      const tag = defineTestElement('hydration-test', HydrationTestEl)
      const el = document.createElement(tag) as InstanceType<typeof HydrationTestEl>
      el.setAttribute('hydrate:idle', '')
      container.appendChild(el)

      // Template should NOT be cloned yet — waiting for idle callback
      expect(el.shadowRoot!.querySelector('span')).toBeNull()
    })

    it('hydrates after idle callback fires', async () => {
      const tag = defineTestElement('hydration-test', HydrationTestEl)
      const el = document.createElement(tag) as InstanceType<typeof HydrationTestEl>
      el.setAttribute('hydrate:idle', '')
      container.appendChild(el)

      // Before idle: no template
      expect(el.shadowRoot!.querySelector('span')).toBeNull()

      // Flush — requestIdleCallback polyfill uses setTimeout(0)
      await flushObservers()

      // After idle: template cloned
      expect(el.shadowRoot!.querySelector('span')).not.toBeNull()
    })

    it('without directive, initializes immediately (backward compat)', () => {
      const tag = defineTestElement('hydration-test', HydrationTestEl)
      const el = document.createElement(tag) as InstanceType<typeof HydrationTestEl>
      container.appendChild(el)

      // No directive — template cloned synchronously
      expect(el.shadowRoot!.querySelector('span')).not.toBeNull()
    })
  })
})
