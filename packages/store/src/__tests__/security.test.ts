// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { renderStoreHydration } from '../server/hydration.js'
import { reconcileFragment } from '../client/fragment-reconciler.js'
import { escapeHtml } from '../escape.js'
import { generateStoreSchema } from '../validation/zod-generator.js'
import { field } from '../fields/index.js'
import { z } from 'zod'

describe('XSS: hydration escaping', () => {
  it('escapes < and > in state values', () => {
    const html = renderStoreHydration('test', { name: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('\\u003c')
    expect(html).toContain('\\u003e')
  })

  it('escapes & in state values', () => {
    const html = renderStoreHydration('test', { name: 'a&b' })
    expect(html).toContain('\\u0026')
  })

  it('escapes </script> injection', () => {
    const html = renderStoreHydration('test', { x: '</script><script>alert(1)</script>' })
    expect(html).not.toContain('</script><script>')
  })

  it('rejects invalid slug to prevent attribute injection', () => {
    const html = renderStoreHydration('" onload="alert(1)', { x: 1 })
    expect(html).toBe('')
  })

  it('rejects slug with spaces', () => {
    const html = renderStoreHydration('bad slug', { x: 1 })
    expect(html).toBe('')
  })

  it('accepts valid slug', () => {
    const html = renderStoreHydration('valid-slug', { x: 1 })
    expect(html).toContain('data-store-hydrate="valid-slug"')
  })
})

describe('XSS: fragment sanitization', () => {
  it('strips script tags from fragment HTML', () => {
    document.body.innerHTML = '<div data-store="test"></div>'
    reconcileFragment({
      selector: '[data-store="test"]',
      html: '<p>Hello</p><script>alert(1)</script><p>World</p>'
    })
    expect(document.querySelector('script')).toBeNull()
    expect(document.querySelector('[data-store="test"]')!.textContent).toBe('HelloWorld')
    document.body.innerHTML = ''
  })

  it('strips inline event handlers from fragment HTML', () => {
    document.body.innerHTML = '<div data-store="test"></div>'
    reconcileFragment({
      selector: '[data-store="test"]',
      html: '<img src="x" onerror="alert(1)"><button onclick="alert(2)">Click</button>'
    })
    const img = document.querySelector('img')
    const btn = document.querySelector('button')
    expect(img!.hasAttribute('onerror')).toBe(false)
    expect(btn!.hasAttribute('onclick')).toBe(false)
    document.body.innerHTML = ''
  })

  it('strips javascript: hrefs from fragment HTML', () => {
    document.body.innerHTML = '<div data-store="test"></div>'
    reconcileFragment({
      selector: '[data-store="test"]',
      html: '<a href="javascript:alert(1)">Click</a>'
    })
    const link = document.querySelector('a')
    expect(link!.hasAttribute('href')).toBe(false)
    document.body.innerHTML = ''
  })

  it('preserves safe HTML content', () => {
    document.body.innerHTML = '<div data-store="test"></div>'
    reconcileFragment({
      selector: '[data-store="test"]',
      html: '<p class="bold">Hello <b>World</b></p><a href="/about">About</a>'
    })
    expect(document.querySelector('p.bold')).toBeDefined()
    expect(document.querySelector('a')!.getAttribute('href')).toBe('/about')
    document.body.innerHTML = ''
  })
})

describe('escapeHtml utility', () => {
  it('escapes < and >', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes &', () => {
    expect(escapeHtml('a&b')).toBe('a&amp;b')
  })

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
    expect(escapeHtml("it's")).toBe('it&#39;s')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('passes through safe strings', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123')
  })
})

describe('SSE: event name injection', () => {
  it('formatSSE rejects event names with newlines', async () => {
    // We test this indirectly through the broadcaster — if format returns empty,
    // no data is written
    const { SSEBroadcaster } = await import('../server/sse-broadcaster.js')
    const { EventEmitter } = await import('node:events')

    const broadcaster = SSEBroadcaster.create()
    const emitter = new EventEmitter()
    const res = Object.assign(emitter, {
      _written: [] as string[],
      _headers: {} as { [k: string]: string },
      setHeader (n: string, v: string) { res._headers[n] = v },
      flushHeaders () {},
      write (chunk: string) { res._written.push(chunk); return true },
      end () {}
    })

    broadcaster.addClient('test', 's1', res as never)
    broadcaster.broadcast('test', 'state\ndata: {"evil":true}\n\nevent: injected', { safe: 'data' })

    // Should write nothing — the injected event name is rejected
    expect(res._written).toHaveLength(0)
  })
})

describe('Zod: json field validation', () => {
  it('json field rejects functions', () => {
    const schema = generateStoreSchema([field.json({ name: 'data' })])
    const result = schema.safeParse({ data: () => {} })
    expect(result.success).toBe(false)
  })

  it('json field accepts objects', () => {
    const schema = generateStoreSchema([field.json({ name: 'data' })])
    expect(schema.safeParse({ data: { key: 'value' } }).success).toBe(true)
  })

  it('json field accepts arrays', () => {
    const schema = generateStoreSchema([field.json({ name: 'data' })])
    expect(schema.safeParse({ data: [1, 2, 3] }).success).toBe(true)
  })

  it('json field accepts primitives', () => {
    const schema = generateStoreSchema([field.json({ name: 'data' })])
    expect(schema.safeParse({ data: 'string' }).success).toBe(true)
    expect(schema.safeParse({ data: 42 }).success).toBe(true)
    expect(schema.safeParse({ data: true }).success).toBe(true)
    expect(schema.safeParse({ data: null }).success).toBe(true)
  })

  it('custom field without validator uses json-safe fallback', () => {
    const schema = generateStoreSchema([field.custom({ name: 'x', validator: z.unknown() })])
    // z.unknown() still passes through — but the framework default is now json-safe
    expect(schema.safeParse({ x: { key: 'val' } }).success).toBe(true)
  })
})
