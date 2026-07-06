// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createStoreClient } from '../client/store-client.js'
import { createPostMutation } from '../client/post-mutation.js'
import { initStores } from '../client/bootstrap.js'
import { generateStoreModule } from '../codegen/store-generator.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import type { StoreDefinition, StoreState } from '../types.js'

interface PostResponse {
  readonly ok: boolean
  readonly state?: StoreState
  readonly confirmedId?: number
  readonly fragment?: { readonly selector: string; readonly html: string }
  readonly error?: { readonly code: string; readonly message: string }
}

function makeCounterConfig (overrides?: { scope?: 'page' | 'session' | 'user' | 'global'; withFragment?: boolean }): StoreDefinition {
  const result = store({
    slug: 'counter',
    scope: overrides?.scope ?? 'session',
    fields: [field.number({ name: 'count', default: 0 })],
    mutations: {
      increment: {
        input: [field.number({ name: 'amount' })],
        server: async ({ state, input }) => {
          state.count = (state.count as number) + (input.amount as number)
        },
        client: ({ state, input }) => {
          state.count = (state.count as number) + (input.amount as number)
        }
      }
    },
    derived: {
      doubled: (state) => (state.count as number) * 2,
      isZero: (state) => (state.count as number) === 0
    },
    ...(overrides?.withFragment
      ? { fragment: (state: StoreState) => `<span>${state.count as number}</span>` }
      : {})
  })
  if (result.isErr()) return undefined as never
  return result.value
}

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

  emit (event: string, data: { readonly [key: string]: unknown }): void {
    for (const handler of this.handlers.get(event) ?? []) {
      handler({ data: JSON.stringify(data) })
    }
  }

  close (): void {
    this.closed = true
  }
}

describe('createPostMutation — fetch transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs {args, mutationId} to /store/<slug>/<mutation> with same-origin credentials', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ ok: true, state: { count: 1 }, confirmedId: 3 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    ))
    vi.stubGlobal('fetch', fetchMock)

    const post = createPostMutation()
    const response = await post('counter', 'increment', { amount: 1 }, 3)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('/store/counter/increment')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('same-origin')
    expect(JSON.parse(init.body as string)).toEqual({ args: { amount: 1 }, mutationId: 3 })
    expect(response.ok).toBe(true)
    expect(response.confirmedId).toBe(3)
  })

  it('returns the server error payload on non-2xx responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: { code: 'VALIDATION_FAILED', message: 'bad input' } }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )))

    const post = createPostMutation()
    const response = await post('counter', 'increment', { amount: 1 }, 1)

    expect(response.ok).toBe(false)
    expect(response.error?.code).toBe('VALIDATION_FAILED')
  })

  it('maps network failures to MUTATION_FAILED without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network down'))))

    const post = createPostMutation()
    const response = await post('counter', 'increment', { amount: 1 }, 1)

    expect(response.ok).toBe(false)
    expect(response.error?.code).toBe('MUTATION_FAILED')
  })
})

describe('derived computeds', () => {
  it('exposes derived definitions as reactive read-only signals', async () => {
    const config = makeCounterConfig()
    const post = vi.fn(async (): Promise<PostResponse> => ({ ok: true, state: { count: 5 }, confirmedId: 1 }))
    const client = createStoreClient(config, {}, post)

    expect(client.derived.doubled!.value).toBe(0)
    expect(client.derived.isZero!.value).toBe(true)

    await client.mutations.increment!({ amount: 5 })

    expect(client.derived.doubled!.value).toBe(10)
    expect(client.derived.isZero!.value).toBe(false)
  })
})

describe('applyServerState', () => {
  it('applies pushed server state to signals (SSE glue entry point)', () => {
    const config = makeCounterConfig()
    const post = vi.fn(async (): Promise<PostResponse> => ({ ok: true, state: {}, confirmedId: 1 }))
    const client = createStoreClient(config, {}, post)

    client.applyServerState({ count: 9 })

    expect(client.signals.count!.value).toBe(9)
  })
})

describe('fragment delivery to the mutator', () => {
  it('invokes onFragment when the POST response carries a fragment', async () => {
    const config = makeCounterConfig({ withFragment: true })
    const onFragment = vi.fn()
    const post = vi.fn(async (): Promise<PostResponse> => ({
      ok: true,
      state: { count: 1 },
      confirmedId: 1,
      fragment: { selector: '[data-store="counter"]', html: '<span>1</span>' }
    }))

    const client = createStoreClient(config, {}, post, { onFragment })
    await client.mutations.increment!({ amount: 1 })

    expect(onFragment).toHaveBeenCalledWith({ selector: '[data-store="counter"]', html: '<span>1</span>' })
  })
})

describe('initStores bootstrap', () => {
  let originalEventSource: typeof EventSource

  beforeEach(() => {
    originalEventSource = globalThis.EventSource
    FakeEventSource.instances = []
    globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
    document.body.innerHTML = ''
  })

  afterEach(() => {
    globalThis.EventSource = originalEventSource
    document.body.innerHTML = ''
  })

  function mountStoreElement (slug: string, hydration?: StoreState): HTMLElement {
    const el = document.createElement('div')
    el.setAttribute('data-store', slug)
    document.body.appendChild(el)
    if (hydration) {
      const tag = document.createElement('script')
      tag.setAttribute('type', 'application/json')
      tag.setAttribute('data-store-hydrate', slug)
      tag.textContent = JSON.stringify(hydration)
      document.body.appendChild(tag)
    }
    return el
  }

  it('hydrates signals from the inline script tag and opens SSE for bound stores', () => {
    mountStoreElement('counter', { count: 5 })

    const handle = initStores([makeCounterConfig()])

    expect(handle.stores.counter!.signals.count!.value).toBe(5)
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(FakeEventSource.instances[0]!.url).toBe('/store/counter/events')
    handle.dispose()
  })

  it('routes SSE state events into the store signals', () => {
    mountStoreElement('counter', { count: 1 })
    const handle = initStores([makeCounterConfig()])

    FakeEventSource.instances[0]!.emit('state', { count: 7 })

    expect(handle.stores.counter!.signals.count!.value).toBe(7)
    handle.dispose()
  })

  it('routes SSE fragment events into DOM swaps', () => {
    const el = mountStoreElement('counter')
    const handle = initStores([makeCounterConfig({ withFragment: true })])

    FakeEventSource.instances[0]!.emit('fragment', {
      selector: '[data-store="counter"]',
      html: '<span>fresh</span>'
    })

    expect(el.innerHTML).toContain('fresh')
    handle.dispose()
  })

  it('opens no SSE connection for page-scoped stores', () => {
    mountStoreElement('counter')
    const handle = initStores([makeCounterConfig({ scope: 'page' })])

    expect(FakeEventSource.instances).toHaveLength(0)
    expect(handle.stores.counter).toBeDefined()
    handle.dispose()
  })

  it('opens no SSE connection when no element is bound to the store', () => {
    const handle = initStores([makeCounterConfig()])

    expect(FakeEventSource.instances).toHaveLength(0)
    handle.dispose()
  })

  it('wires click delegation for data-mutation triggers', async () => {
    mountStoreElement('counter')
    const postMutation = vi.fn(async (): Promise<PostResponse> => ({ ok: true, state: { count: 1 }, confirmedId: 1 }))
    const handle = initStores([makeCounterConfig()], { postMutation })

    const btn = document.createElement('button')
    btn.setAttribute('data-store', 'counter')
    btn.setAttribute('data-mutation', 'increment')
    btn.setAttribute('data-args', '{"amount":1}')
    document.body.appendChild(btn)

    btn.click()
    await new Promise(resolve => { setTimeout(resolve, 0) })

    expect(postMutation).toHaveBeenCalledTimes(1)
    handle.dispose()
  })
})

describe('codegen runtime factory', () => {
  it('emits a typed runtime factory instead of a phantom declare-const', () => {
    const config = makeCounterConfig()
    const module = generateStoreModule(config)

    expect(module).not.toContain('export declare const')
    expect(module).toContain("from '@valencets/store/client'")
    expect(module).toContain('export function createCounterStore')
    expect(module).toContain('CounterStore')
  })

  it('types derived signals in the generated store interface', () => {
    const config = makeCounterConfig()
    const module = generateStoreModule(config)

    expect(module).toContain('readonly derived')
    expect(module).toContain('doubled')
  })
})
