import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initEventDelegation } from '../event-delegation.js'
import { TelemetryRingBuffer } from '../ring-buffer.js'
import { IntentType } from '../intent-types.js'
import type { EventDelegationHandle } from '../event-delegation.js'

function createTrackedElement (type: string, target?: string): HTMLElement {
  const el = document.createElement('button')
  el.setAttribute('data-telemetry-type', type)
  if (target !== undefined) {
    el.setAttribute('data-telemetry-target', target)
  }
  document.body.appendChild(el)
  return el
}

function clickElement (el: HTMLElement, x = 0, y = 0): void {
  const event = new MouseEvent('click', {
    bubbles: true,
    clientX: x,
    clientY: y
  })
  el.dispatchEvent(event)
}

describe('initEventDelegation', () => {
  let buffer: TelemetryRingBuffer
  let handle: EventDelegationHandle | null

  beforeEach(() => {
    const result = TelemetryRingBuffer.create(64)
    if (result.isErr()) {
      throw new Error('Failed to create buffer for test')
    }
    buffer = result.value
    handle = null
  })

  afterEach(() => {
    if (handle) {
      handle.destroy()
    }
    document.body.innerHTML = ''
  })

  it('returns Ok with handle', () => {
    const result = initEventDelegation(buffer)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      handle = result.value
      expect(handle).toBeDefined()
      expect(typeof handle.destroy).toBe('function')
    }
  })

  it('attaches one listener via addEventListener', () => {
    const spy = vi.spyOn(document.body, 'addEventListener')
    const result = initEventDelegation(buffer)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      handle = result.value
    }
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function))
    spy.mockRestore()
  })

  it('click on tracked element writes to buffer with correct IntentType', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = createTrackedElement('CLICK', 'button.cta')
    clickElement(el, 150, 250)

    expect(buffer.count).toBe(1)
    const dirty = buffer.collectDirty()
    expect(dirty).toHaveLength(1)
    expect(dirty[0]!.type).toBe(IntentType.CLICK)
    expect(dirty[0]!.targetDOMNode).toBe('button.cta')
    expect(dirty[0]!.x_coord).toBe(150)
    expect(dirty[0]!.y_coord).toBe(250)
  })

  it('click on child bubbles up to tracked ancestor', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const parent = createTrackedElement('SCROLL', 'section.hero')
    const child = document.createElement('span')
    child.textContent = 'inner text'
    parent.appendChild(child)

    clickElement(child, 10, 20)

    expect(buffer.count).toBe(1)
    const dirty = buffer.collectDirty()
    expect(dirty[0]!.type).toBe(IntentType.SCROLL)
    expect(dirty[0]!.targetDOMNode).toBe('section.hero')
  })

  it('click without telemetry attrs results in no write', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = document.createElement('div')
    document.body.appendChild(el)
    clickElement(el)

    expect(buffer.count).toBe(0)
  })

  it('invalid type attr results in no write', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = createTrackedElement('INVALID_TYPE', 'x')
    clickElement(el)

    expect(buffer.count).toBe(0)
  })

  it('missing data-telemetry-target uses empty string', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = createTrackedElement('CLICK')
    clickElement(el, 5, 10)

    expect(buffer.count).toBe(1)
    const dirty = buffer.collectDirty()
    expect(dirty[0]!.targetDOMNode).toBe('')
  })

  it('clientX/clientY written as coordinates', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = createTrackedElement('INTENT_CALL', 'phone-link')
    clickElement(el, 320, 480)

    const dirty = buffer.collectDirty()
    expect(dirty[0]!.x_coord).toBe(320)
    expect(dirty[0]!.y_coord).toBe(480)
  })

  it('destroy removes listener and subsequent clicks are no-op', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = createTrackedElement('CLICK', 'btn')
    clickElement(el)
    expect(buffer.count).toBe(1)

    handle!.destroy()
    handle = null

    clickElement(el)
    expect(buffer.count).toBe(1)
  })

  it('multiple rapid clicks produce multiple writes', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = createTrackedElement('CLICK', 'rapid')
    for (let i = 0; i < 10; i++) {
      clickElement(el, i, i)
    }

    expect(buffer.count).toBe(10)
    const dirty = buffer.collectDirty()
    expect(dirty).toHaveLength(10)
  })

  it('sets path to current pathname on intent', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = createTrackedElement('CLICK', 'nav')
    clickElement(el)

    const dirty = buffer.collectDirty()
    expect(dirty[0]!.path).toBe(window.location.pathname)
  })

  it('sets referrer to document.referrer on intent', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const el = createTrackedElement('CLICK', 'nav')
    clickElement(el)

    const dirty = buffer.collectDirty()
    expect(typeof dirty[0]!.referrer).toBe('string')
  })

  it('fires LEAD_PHONE for tel: link clicks', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const link = document.createElement('a')
    link.href = 'tel:+15551234567'
    link.textContent = 'Call us'
    document.body.appendChild(link)
    clickElement(link)

    const dirty = buffer.collectDirty()
    expect(dirty).toHaveLength(1)
    expect(dirty[0]!.type).toBe(IntentType.LEAD_PHONE)
  })

  it('fires LEAD_EMAIL for mailto: link clicks', () => {
    const result = initEventDelegation(buffer)
    if (result.isOk()) handle = result.value

    const link = document.createElement('a')
    link.href = 'mailto:hello@example.com'
    link.textContent = 'Email us'
    document.body.appendChild(link)
    clickElement(link)

    const dirty = buffer.collectDirty()
    expect(dirty).toHaveLength(1)
    expect(dirty[0]!.type).toBe(IntentType.LEAD_EMAIL)
  })
})
