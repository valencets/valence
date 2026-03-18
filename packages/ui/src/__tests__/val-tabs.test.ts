import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValTabs } from '../components/val-tabs.js'
import { defineTestElement } from './test-helpers.js'

describe('ValTabs', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (): InstanceType<typeof ValTabs> {
    const tag = defineTestElement('val-tabs', ValTabs)
    const el = document.createElement(tag) as InstanceType<typeof ValTabs>
    el.innerHTML = `
      <div slot="tab" data-panel="one">Tab One</div>
      <div slot="tab" data-panel="two">Tab Two</div>
      <div slot="tab" data-panel="three">Tab Three</div>
      <div slot="panel" data-name="one">Panel One Content</div>
      <div slot="panel" data-name="two">Panel Two Content</div>
      <div slot="panel" data-name="three">Panel Three Content</div>
    `
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('uses shadow DOM', () => {
      const el = create()
      expect(el.shadowRoot).not.toBeNull()
    })

    it('has tablist role on tab container', () => {
      const el = create()
      const tablist = el.shadowRoot!.querySelector('[role="tablist"]')
      expect(tablist).not.toBeNull()
    })

    it('has slots for tabs and panels', () => {
      const el = create()
      const tabSlot = el.shadowRoot!.querySelector('slot[name="tab"]')
      const panelSlot = el.shadowRoot!.querySelector('slot[name="panel"]')
      expect(tabSlot).not.toBeNull()
      expect(panelSlot).not.toBeNull()
    })
  })

  describe('ARIA', () => {
    it('sets role=tab on slotted tab elements', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]')
      for (const tab of tabs) {
        expect(tab.getAttribute('role')).toBe('tab')
      }
    })

    it('sets role=tabpanel on slotted panel elements', () => {
      const el = create()
      const panels = el.querySelectorAll('[slot="panel"]')
      for (const panel of panels) {
        expect(panel.getAttribute('role')).toBe('tabpanel')
      }
    })

    it('first tab is selected by default', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]')
      expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
      expect(tabs[1]!.getAttribute('aria-selected')).toBe('false')
    })

    it('first panel is visible, others hidden', () => {
      const el = create()
      const panels = el.querySelectorAll('[slot="panel"]')
      expect((panels[0] as HTMLElement).hidden).toBe(false)
      expect((panels[1] as HTMLElement).hidden).toBe(true)
      expect((panels[2] as HTMLElement).hidden).toBe(true)
    })

    it('sets aria-controls on tabs linking to panel IDs', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]')
      expect(tabs[0]!.getAttribute('aria-controls')).toBe('panel-one')
      expect(tabs[1]!.getAttribute('aria-controls')).toBe('panel-two')
    })

    it('sets aria-labelledby on panels linking to tab IDs', () => {
      const el = create()
      const panels = el.querySelectorAll('[slot="panel"]')
      expect(panels[0]!.getAttribute('aria-labelledby')).toBe('tab-one')
      expect(panels[1]!.getAttribute('aria-labelledby')).toBe('tab-two')
    })

    it('shows correct panel when DOM order differs from tab order', () => {
      const tag = defineTestElement('val-tabs', ValTabs)
      const el = document.createElement(tag) as InstanceType<typeof ValTabs>
      // Panels in reverse order
      el.innerHTML = `
        <div slot="tab" data-panel="a">A</div>
        <div slot="tab" data-panel="b">B</div>
        <div slot="panel" data-name="b">B Content</div>
        <div slot="panel" data-name="a">A Content</div>
      `
      container.appendChild(el)

      const panels = el.querySelectorAll('[slot="panel"]')
      // Panel "a" should be visible (matches first tab), regardless of DOM order
      expect((panels[0] as HTMLElement).hidden).toBe(true)  // "b" panel
      expect((panels[1] as HTMLElement).hidden).toBe(false)  // "a" panel
    })
  })

  describe('tab selection', () => {
    it('switches panel on tab click', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]')
      const panels = el.querySelectorAll('[slot="panel"]');

      (tabs[1] as HTMLElement).click()

      expect(tabs[0]!.getAttribute('aria-selected')).toBe('false')
      expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
      expect((panels[0] as HTMLElement).hidden).toBe(true)
      expect((panels[1] as HTMLElement).hidden).toBe(false)
    })

    it('emits val:interaction on tab change', () => {
      const el = create()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      ;(el.querySelectorAll('[slot="tab"]')[2] as HTMLElement).click()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('change')
      expect(detail.panel).toBe('three')
    })
  })

  describe('keyboard navigation', () => {
    it('ArrowRight moves to next tab', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]');

      (tabs[0] as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      )

      expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    })

    it('ArrowLeft moves to previous tab', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]');

      // Select second tab first
      (tabs[1] as HTMLElement).click();
      (tabs[1] as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
      )

      expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    })

    it('ArrowRight wraps from last to first', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]');

      (tabs[2] as HTMLElement).click();
      (tabs[2] as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
      )

      expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    })

    it('Home selects first tab', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]');

      (tabs[2] as HTMLElement).click();
      (tabs[2] as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
      )

      expect(tabs[0]!.getAttribute('aria-selected')).toBe('true')
    })

    it('End selects last tab', () => {
      const el = create()
      const tabs = el.querySelectorAll('[slot="tab"]');

      (tabs[0] as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true })
      )

      expect(tabs[2]!.getAttribute('aria-selected')).toBe('true')
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const tag = defineTestElement('val-tabs', ValTabs)
      const el = document.createElement(tag)
      el.setAttribute('data-cms-id', 'settings-tabs')
      container.appendChild(el)
      expect((el as InstanceType<typeof ValTabs>).cmsId).toBe('settings-tabs')
    })
  })
})
