// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SSEListener } from '../client/sse-listener.js'
import { initMutationDelegation } from '../client/mutation-delegate.js'

type EventHandler = (event: { data: string }) => void

class FakeEventSource {
  static instances: FakeEventSource[] = []
  readonly url: string
  readonly handlers: Map<string, EventHandler[]>
  closed: boolean

  constructor (url: string) {
    this.url = url
    this.handlers = new Map()
    this.closed = false
    FakeEventSource.instances.push(this)
  }

  addEventListener (event: string, handler: EventHandler): void {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  }

  emit (event: string, data: string): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler({ data })
    }
  }

  close (): void {
    this.closed = true
  }
}

describe('SSEListener hardening', () => {
  let originalEventSource: typeof EventSource

  beforeEach(() => {
    originalEventSource = globalThis.EventSource
    FakeEventSource.instances = []
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
  })

  it('ignores malformed JSON in an SSE event instead of throwing', () => {
    const listener = SSEListener.create('/store/counter/events')
    const callback = vi.fn()
    listener.onState(callback)

    const source = FakeEventSource.instances[0]!
    expect(() => { source.emit('state', '{not valid json') }).not.toThrow()
    expect(callback).not.toHaveBeenCalled()

    // A well-formed event afterwards still dispatches
    source.emit('state', '{"count":1}')
    expect(callback).toHaveBeenCalledWith({ count: 1 })
    listener.disconnect()
  })

  it('reports connected=false when EventSource is unavailable', () => {
    globalThis.EventSource = undefined as unknown as typeof EventSource
    const listener = SSEListener.create('/store/counter/events')
    expect(listener.connected).toBe(false)
  })

  it('reports connected=true while a source is open and false after disconnect', () => {
    const listener = SSEListener.create('/store/counter/events')
    expect(listener.connected).toBe(true)
    listener.disconnect()
    expect(listener.connected).toBe(false)
  })
})

describe('mutation delegation hardening', () => {
  let root: HTMLElement

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  function makeTrigger (args: string | null): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'counter')
    btn.setAttribute('data-mutation', 'increment')
    if (args !== null) btn.setAttribute('data-args', args)
    root.appendChild(btn)
    return btn
  }

  it('does not invoke the mutation and does not throw on malformed data-args', () => {
    const mutate = vi.fn().mockResolvedValue({ isOk: () => true, isErr: () => false })
    const handle = initMutationDelegation(root, {
      counter: { mutations: { increment: mutate }, signals: {} }
    })

    const btn = makeTrigger('{broken json')
    expect(() => { btn.click() }).not.toThrow()
    expect(mutate).not.toHaveBeenCalled()
    expect(btn.classList.contains('is-pending')).toBe(false)
    handle.destroy()
  })

  it('marks the trigger with is-error when the mutation resolves to an err Result', async () => {
    const mutate = vi.fn().mockResolvedValue({ isOk: () => false, isErr: () => true })
    const handle = initMutationDelegation(root, {
      counter: { mutations: { increment: mutate }, signals: {} }
    })

    const btn = makeTrigger('{"amount":1}')
    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(btn.classList.contains('is-pending')).toBe(false)
    expect(btn.classList.contains('is-error')).toBe(true)
    handle.destroy()
  })

  it('clears is-error on the next attempt', async () => {
    let failNext = true
    const mutate = vi.fn().mockImplementation(async () => {
      const failed = failNext
      failNext = false
      return { isOk: () => !failed, isErr: () => failed }
    })
    const handle = initMutationDelegation(root, {
      counter: { mutations: { increment: mutate }, signals: {} }
    })

    const btn = makeTrigger('{"amount":1}')
    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(btn.classList.contains('is-error')).toBe(true)

    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })
    expect(btn.classList.contains('is-error')).toBe(false)
    handle.destroy()
  })

  it('removes is-pending even when the mutation promise rejects', async () => {
    const mutate = vi.fn().mockRejectedValue(new Error('transport died'))
    const handle = initMutationDelegation(root, {
      counter: { mutations: { increment: mutate }, signals: {} }
    })

    const btn = makeTrigger('{"amount":1}')
    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(btn.classList.contains('is-pending')).toBe(false)
    expect(btn.classList.contains('is-error')).toBe(true)
    handle.destroy()
  })
})
