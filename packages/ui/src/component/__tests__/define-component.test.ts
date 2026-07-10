import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { defineComponent, signal } from '../index.js'

let counter = 0
const uniqueTag = (): string => `x-comp-${++counter}`

describe('defineComponent', () => {
  let host: HTMLDivElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    host.remove()
  })

  const mount = (tag: string, attrs?: Readonly<Record<string, string>>): HTMLElement => {
    const el = document.createElement(tag)
    if (attrs !== undefined) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    host.appendChild(el)
    return el
  }

  it('returns the tag, an element constructor, and an idempotent define()', () => {
    const tag = uniqueTag()
    const dc = defineComponent({ tag, template: '<p>hi</p>' })
    expect(dc.tag).toBe(tag)
    expect(typeof dc.element).toBe('function')
    // Importing/creating a definition must not auto-register (side-effect free).
    expect(customElements.get(tag)).toBeUndefined()
    dc.define()
    expect(customElements.get(tag)).toBe(dc.element)
    dc.define() // second call is a no-op, not a re-definition error
    expect(customElements.get(tag)).toBe(dc.element)
  })

  it('clones the template into a shadow root and injects scoped styles', () => {
    const tag = uniqueTag()
    defineComponent({ tag, template: '<p class="msg">hi</p>', styles: '.msg{color:red}' }).define()
    const el = mount(tag)
    expect(el.shadowRoot).not.toBeNull()
    expect(el.shadowRoot!.querySelector('.msg')?.textContent).toBe('hi')
    expect(el.shadowRoot!.querySelector('style')?.textContent).toContain('color:red')
  })

  it('renders into light DOM when shadow is false', () => {
    const tag = uniqueTag()
    defineComponent({ tag, shadow: false, template: '<p class="l">hi</p>' }).define()
    const el = mount(tag)
    expect(el.shadowRoot).toBeNull()
    expect(el.querySelector('.l')?.textContent).toBe('hi')
  })

  it('parses props with type coercion and defaults into setup', () => {
    const tag = uniqueTag()
    let captured: { s: unknown; n: unknown; b: unknown } | null = null
    defineComponent({
      tag,
      props: {
        label: { type: 'string', default: 'hi' },
        num: { type: 'number', default: 3 },
        flag: { type: 'boolean', default: false }
      },
      template: '<p></p>',
      setup ({ props }) {
        captured = { s: props.label, n: props.num, b: props.flag }
        return {}
      }
    }).define()
    mount(tag, { num: '42', flag: '' })
    expect(captured).toEqual({ s: 'hi', n: 42, b: true })
  })

  it('binds text to a signal and reacts to event handlers via data-bind', () => {
    const tag = uniqueTag()
    defineComponent({
      tag,
      props: { start: { type: 'number', default: 0 } },
      template: '<button data-bind="onclick:inc"><span class="c" data-bind="text:count"></span></button>',
      setup ({ props }) {
        const count = signal(props.start)
        return { count, inc: () => { count.value = count.value + 1 } }
      }
    }).define()
    const el = mount(tag, { start: '5' })
    const span = el.shadowRoot!.querySelector('.c')!
    expect(span.textContent).toBe('5')
    ;(el.shadowRoot!.querySelector('button') as HTMLElement).click()
    expect(span.textContent).toBe('6')
  })

  it('toggles classes reactively from a boolean signal', () => {
    const tag = uniqueTag()
    let openRef: { value: boolean } | null = null
    defineComponent({
      tag,
      template: '<div class="box" data-bind="class:open:isOpen"></div>',
      setup () {
        const isOpen = signal(false)
        openRef = isOpen
        return { isOpen }
      }
    }).define()
    const el = mount(tag)
    const box = el.shadowRoot!.querySelector('.box')!
    expect(box.classList.contains('open')).toBe(false)
    openRef!.value = true
    expect(box.classList.contains('open')).toBe(true)
  })

  it('two-way binds an input value to a signal', () => {
    const tag = uniqueTag()
    let nameRef: { value: string } | null = null
    defineComponent({
      tag,
      template: '<input data-bind="value:name">',
      setup () {
        const name = signal('a')
        nameRef = name
        return { name }
      }
    }).define()
    const el = mount(tag)
    const input = el.shadowRoot!.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('a')
    nameRef!.value = 'b'
    expect(input.value).toBe('b')
    input.value = 'typed'
    input.dispatchEvent(new Event('input'))
    expect(nameRef!.value).toBe('typed')
  })

  it('disposes bindings on disconnect so signals stop driving the DOM', () => {
    const tag = uniqueTag()
    let msgRef: { value: string } | null = null
    defineComponent({
      tag,
      template: '<span data-bind="text:msg"></span>',
      setup () {
        const msg = signal('x')
        msgRef = msg
        return { msg }
      }
    }).define()
    const el = mount(tag)
    const span = el.shadowRoot!.querySelector('span')!
    expect(span.textContent).toBe('x')
    el.remove()
    msgRef!.value = 'y'
    expect(span.textContent).toBe('x')
  })

  it('inherits ValElement telemetry — setup ctx.emit dispatches an interaction event', () => {
    const tag = uniqueTag()
    let emit: ((action: string) => void) | null = null
    defineComponent({
      tag,
      template: '<p>hi</p>',
      setup ({ ctx }) {
        emit = (action: string) => { ctx.emit(action) }
        return {}
      }
    }).define()
    const el = mount(tag)
    const events: string[] = []
    el.addEventListener('val:interaction', (e) => {
      events.push((e as CustomEvent<{ action: string }>).detail.action)
    })
    emit!('poke')
    expect(events).toContain('poke')
  })
})
