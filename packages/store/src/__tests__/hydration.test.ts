// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { renderStoreHydration } from '../server/hydration.js'
import { readHydrationState } from '../client/hydration.js'
import type { StoreState } from '../types.js'

describe('renderStoreHydration (server)', () => {
  it('renders a script tag with JSON state', () => {
    const html = renderStoreHydration('counter', { count: 42 })
    expect(html).toContain('<script')
    expect(html).toContain('type="application/json"')
    expect(html).toContain('data-store-hydrate="counter"')
    expect(html).toContain('"count":42')
    expect(html).toContain('</script>')
  })

  it('renders empty state', () => {
    const html = renderStoreHydration('empty', {})
    expect(html).toContain('data-store-hydrate="empty"')
    expect(html).toContain('{}')
  })

  it('renders complex nested state', () => {
    const state: StoreState = {
      items: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 3 }],
      status: 'open',
      coupon: undefined
    }
    const html = renderStoreHydration('cart', state)
    expect(html).toContain('data-store-hydrate="cart"')
    expect(html).toContain('"sku":"A"')
    expect(html).toContain('"sku":"B"')
  })

  it('escapes </script> in state values to prevent XSS', () => {
    const state: StoreState = {
      content: '</script><script>alert(1)</script>'
    }
    const html = renderStoreHydration('xss-test', state)
    expect(html).not.toContain('</script><script>')
  })
})

describe('readHydrationState (client)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('reads state from hydration script tag', () => {
    const script = document.createElement('script')
    script.type = 'application/json'
    script.setAttribute('data-store-hydrate', 'counter')
    script.textContent = '{"count":42}'
    document.body.appendChild(script)

    const state = readHydrationState('counter')
    expect(state).toEqual({ count: 42 })
  })

  it('returns empty object when no hydration tag found', () => {
    const state = readHydrationState('nonexistent')
    expect(state).toEqual({})
  })

  it('returns empty object when hydration tag has invalid JSON', () => {
    const script = document.createElement('script')
    script.type = 'application/json'
    script.setAttribute('data-store-hydrate', 'bad')
    script.textContent = 'not json'
    document.body.appendChild(script)

    const state = readHydrationState('bad')
    expect(state).toEqual({})
  })

  it('reads complex nested state', () => {
    const script = document.createElement('script')
    script.type = 'application/json'
    script.setAttribute('data-store-hydrate', 'cart')
    script.textContent = '{"items":[{"sku":"A","qty":1}],"status":"open"}'
    document.body.appendChild(script)

    const state = readHydrationState('cart')
    const items = state.items as Array<{ sku: string }>
    expect(items).toHaveLength(1)
    expect(items[0]!.sku).toBe('A')
    expect(state.status).toBe('open')
  })

  it('reads escaped content correctly', () => {
    const script = document.createElement('script')
    script.type = 'application/json'
    script.setAttribute('data-store-hydrate', 'escaped')
    script.textContent = '{"text":"hello <b>world</b>"}'
    document.body.appendChild(script)

    const state = readHydrationState('escaped')
    expect(state.text).toBe('hello <b>world</b>')
  })

  it('removes hydration tag after reading', () => {
    const script = document.createElement('script')
    script.type = 'application/json'
    script.setAttribute('data-store-hydrate', 'cleanup')
    script.textContent = '{"x":1}'
    document.body.appendChild(script)

    readHydrationState('cleanup')
    expect(document.querySelector('[data-store-hydrate="cleanup"]')).toBeNull()
  })
})
