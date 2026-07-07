import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValSelect } from '../components/val-select.js'
import { defineTestElement, flushObservers } from './test-helpers.js'

describe('ValSelect', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValSelect> {
    const tag = defineTestElement('val-select', ValSelect)
    const el = document.createElement(tag) as InstanceType<typeof ValSelect>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    // Add options
    for (const [value, label] of [['red', 'Red'], ['green', 'Green'], ['blue', 'Blue']]) {
      const opt = document.createElement('option')
      opt.setAttribute('value', value!)
      opt.textContent = label!
      el.appendChild(opt)
    }
    container.appendChild(el)
    return el
  }

  describe('DOM structure', () => {
    it('renders trigger button and listbox', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('.trigger')).not.toBeNull()
      expect(el.shadowRoot!.querySelector('.listbox')).not.toBeNull()
    })

    it('builds option elements from light DOM <option>s', async () => {
      const el = create()
      await flushObservers()
      const options = el.shadowRoot!.querySelectorAll('.option')
      expect(options.length).toBe(3)
      expect(options[0]!.textContent).toBe('Red')
    })

    it('trigger has combobox role', () => {
      const el = create()
      const trigger = el.shadowRoot!.querySelector('.trigger')!
      expect(trigger.getAttribute('role')).toBe('combobox')
      expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
    })

    it('listbox has listbox role', () => {
      const el = create()
      expect(el.shadowRoot!.querySelector('.listbox')!.getAttribute('role')).toBe('listbox')
    })
  })

  describe('value', () => {
    it('starts with empty value', () => {
      const el = create()
      expect(el.value).toBe('')
    })

    it('sets value programmatically', () => {
      const el = create()
      el.value = 'green'
      expect(el.value).toBe('green')
    })

    it('shows placeholder when no value selected', () => {
      const el = create({ placeholder: 'Pick a color' })
      const text = el.shadowRoot!.querySelector('.trigger-text')!
      expect(text.textContent).toBe('Pick a color')
    })

    it('shows selected label in trigger', () => {
      const el = create()
      el.value = 'blue'
      const text = el.shadowRoot!.querySelector('.trigger-text')!
      expect(text.textContent).toBe('Blue')
    })
  })

  describe('open/close', () => {
    it('opens on trigger click', () => {
      const el = create()
      el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
      expect(el.hasAttribute('open')).toBe(true)
      expect(el.shadowRoot!.querySelector('.trigger')!.getAttribute('aria-expanded')).toBe('true')
    })

    it('closes on second trigger click', () => {
      const el = create()
      const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!
      trigger.click()
      trigger.click()
      expect(el.hasAttribute('open')).toBe(false)
    })

    it('closes on Escape', () => {
      const el = create()
      const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!
      trigger.click()
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(el.hasAttribute('open')).toBe(false)
    })
  })

  describe('keyboard navigation', () => {
    it('opens on ArrowDown', () => {
      const el = create()
      const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      expect(el.hasAttribute('open')).toBe(true)
    })

    it('navigates with arrow keys', () => {
      const el = create()
      const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!
      trigger.click() // open
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      const focused = el.shadowRoot!.querySelector('.option.focused')
      expect(focused).not.toBeNull()
    })

    it('selects with Enter', () => {
      const el = create()
      const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!
      trigger.click()
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(el.value).toBe('red')
      expect(el.hasAttribute('open')).toBe(false)
    })
  })

  describe('selection', () => {
    it('selects on option click', async () => {
      const el = create()
      await flushObservers()
      el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
      const opts = el.shadowRoot!.querySelectorAll('.option')
      ;(opts[1] as HTMLElement).click()
      expect(el.value).toBe('green')
    })

    it('emits val:interaction on selection', async () => {
      const el = create()
      await flushObservers()
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
      ;(el.shadowRoot!.querySelectorAll('.option')[2] as HTMLElement).click()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('change')
      expect(detail.value).toBe('blue')
    })
  })

  describe('form association', () => {
    it('has static formAssociated = true', () => {
      expect(ValSelect.formAssociated).toBe(true)
    })

    it('resets on formResetCallback', () => {
      const el = create()
      el.value = 'red'
      el.formResetCallback()
      expect(el.value).toBe('')
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'color-picker' })
      expect(el.cmsId).toBe('color-picker')
    })
  })
})

describe('change event contract', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  it('dispatches a composed bubbling change event when an option is selected', async () => {
    const tag = defineTestElement('val-select', ValSelect)
    const el = document.createElement(tag) as InstanceType<typeof ValSelect>
    for (const value of ['red', 'green']) {
      const opt = document.createElement('option')
      opt.value = value
      opt.textContent = value
      el.appendChild(opt)
    }
    container.appendChild(el)
    await Promise.resolve()

    const seen: Event[] = []
    container.addEventListener('change', (event) => { seen.push(event) })

    el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!.click()
    el.shadowRoot!.querySelectorAll<HTMLElement>('.option')[1]!.click()

    expect(seen).toHaveLength(1)
    expect(seen[0]!.bubbles).toBe(true)
    expect(seen[0]!.composed).toBe(true)
    expect((seen[0]!.target as InstanceType<typeof ValSelect>).value).toBe('green')
  })
})
