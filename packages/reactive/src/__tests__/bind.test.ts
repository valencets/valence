import { describe, it, expect, afterEach } from 'vitest'
import { signal } from '../core.js'
import { bind } from '../bind.js'

describe('bind()', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function el (tag: string): HTMLElement {
    const e = document.createElement(tag)
    document.body.appendChild(e)
    return e
  }

  function input (): HTMLInputElement {
    return el('input') as HTMLInputElement
  }

  describe('text binding', () => {
    it('sets textContent from signal', () => {
      const s = signal('hello')
      const div = el('div')
      bind(div, { text: s })
      expect(div.textContent).toBe('hello')
    })

    it('updates textContent when signal changes', () => {
      const s = signal('a')
      const div = el('div')
      bind(div, { text: s })
      s.value = 'b'
      expect(div.textContent).toBe('b')
    })
  })

  describe('value binding (two-way)', () => {
    it('sets input value from signal', () => {
      const s = signal('init')
      const inp = input()
      bind(inp, { value: s })
      expect(inp.value).toBe('init')
    })

    it('updates input when signal changes', () => {
      const s = signal('')
      const inp = input()
      bind(inp, { value: s })
      s.value = 'updated'
      expect(inp.value).toBe('updated')
    })

    it('updates signal when user types (input event)', () => {
      const s = signal('')
      const inp = input()
      bind(inp, { value: s })
      inp.value = 'typed'
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      expect(s.value).toBe('typed')
    })
  })

  describe('checked binding (two-way)', () => {
    it('sets checkbox checked from signal', () => {
      const s = signal(true)
      const inp = input()
      inp.type = 'checkbox'
      bind(inp, { checked: s })
      expect(inp.checked).toBe(true)
    })

    it('updates signal on change event', () => {
      const s = signal(false)
      const inp = input()
      inp.type = 'checkbox'
      bind(inp, { checked: s })
      inp.checked = true
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      expect(s.value).toBe(true)
    })
  })

  describe('visible binding', () => {
    it('hides element when signal is false', () => {
      const s = signal(false)
      const div = el('div')
      bind(div, { visible: s })
      expect(div.style.display).toBe('none')
    })

    it('shows element when signal becomes true', () => {
      const s = signal(false)
      const div = el('div')
      bind(div, { visible: s })
      s.value = true
      expect(div.style.display).toBe('')
    })
  })

  describe('class binding', () => {
    it('adds class when signal is true', () => {
      const s = signal(true)
      const div = el('div')
      bind(div, { class: { active: s } })
      expect(div.classList.contains('active')).toBe(true)
    })

    it('removes class when signal becomes false', () => {
      const s = signal(true)
      const div = el('div')
      bind(div, { class: { active: s } })
      s.value = false
      expect(div.classList.contains('active')).toBe(false)
    })
  })

  describe('attr binding', () => {
    it('sets attribute from signal', () => {
      const s = signal('Submit')
      const div = el('div')
      bind(div, { attr: { 'aria-label': s } })
      expect(div.getAttribute('aria-label')).toBe('Submit')
    })

    it('removes attribute when signal is null', () => {
      const s = signal<string | null>('yes')
      const div = el('div')
      bind(div, { attr: { 'aria-expanded': s } })
      expect(div.getAttribute('aria-expanded')).toBe('yes')
      s.value = null
      expect(div.hasAttribute('aria-expanded')).toBe(false)
    })
  })

  describe('disabled binding', () => {
    it('disables element when signal is true', () => {
      const s = signal(true)
      const inp = input()
      bind(inp, { disabled: s })
      expect(inp.disabled).toBe(true)
    })

    it('enables element when signal becomes false', () => {
      const s = signal(true)
      const inp = input()
      bind(inp, { disabled: s })
      s.value = false
      expect(inp.disabled).toBe(false)
    })
  })

  describe('dispose', () => {
    it('returns a dispose function that stops all bindings', () => {
      const s = signal('hello')
      const div = el('div')
      const dispose = bind(div, { text: s })
      expect(div.textContent).toBe('hello')
      dispose()
      s.value = 'world'
      expect(div.textContent).toBe('hello') // not updated
    })

    it('removes input event listener on dispose', () => {
      const s = signal('')
      const inp = input()
      const dispose = bind(inp, { value: s })
      dispose()
      inp.value = 'after-dispose'
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      expect(s.value).toBe('') // should not have updated
    })

    it('removes change event listener on dispose', () => {
      const s = signal(false)
      const inp = input()
      inp.type = 'checkbox'
      const dispose = bind(inp, { checked: s })
      dispose()
      inp.checked = true
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      expect(s.value).toBe(false) // should not have updated
    })
  })

  describe('security', () => {
    it('blocks on* event handler attributes', () => {
      const s = signal('alert(1)')
      const div = el('div')
      bind(div, { attr: { onclick: s, onmouseover: s, 'aria-label': signal('safe') } })
      expect(div.hasAttribute('onclick')).toBe(false)
      expect(div.hasAttribute('onmouseover')).toBe(false)
      expect(div.getAttribute('aria-label')).toBe('safe')
    })
  })
})
