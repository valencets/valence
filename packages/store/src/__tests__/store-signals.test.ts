// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { createStoreSignals } from '../client/store-signals.js'
import { field } from '../fields/index.js'
import { effect } from '@valencets/reactive'

describe('createStoreSignals', () => {
  it('creates signals from field definitions with initial state', () => {
    const fields = [
      field.text({ name: 'title' }),
      field.number({ name: 'count', default: 0 })
    ]
    const signals = createStoreSignals(fields, { title: 'Hello', count: 5 })
    expect(signals.title.value).toBe('Hello')
    expect(signals.count.value).toBe(5)
  })

  it('uses field defaults when no initial state provided', () => {
    const fields = [
      field.number({ name: 'count', default: 0 }),
      field.boolean({ name: 'active', default: true }),
      field.text({ name: 'name' })
    ]
    const signals = createStoreSignals(fields, {})
    expect(signals.count.value).toBe(0)
    expect(signals.active.value).toBe(true)
    expect(signals.name.value).toBeUndefined()
  })

  it('initial state overrides field defaults', () => {
    const fields = [
      field.number({ name: 'count', default: 0 })
    ]
    const signals = createStoreSignals(fields, { count: 42 })
    expect(signals.count.value).toBe(42)
  })

  it('signals are writable', () => {
    const fields = [field.text({ name: 'name' })]
    const signals = createStoreSignals(fields, { name: 'Alice' })
    signals.name.value = 'Bob'
    expect(signals.name.value).toBe('Bob')
  })

  it('signals are reactive — effects track changes', () => {
    const fields = [field.number({ name: 'count', default: 0 })]
    const signals = createStoreSignals(fields, {})
    const values: number[] = []

    effect(() => {
      values.push(signals.count.value as number)
    })

    expect(values).toEqual([0])
    signals.count.value = 1
    expect(values).toEqual([0, 1])
    signals.count.value = 2
    expect(values).toEqual([0, 1, 2])
  })

  it('handles select field', () => {
    const fields = [
      field.select({ name: 'status', options: ['draft', 'published'], default: 'draft' })
    ]
    const signals = createStoreSignals(fields, {})
    expect(signals.status.value).toBe('draft')
    signals.status.value = 'published'
    expect(signals.status.value).toBe('published')
  })

  it('handles multiselect field as array signal', () => {
    const fields = [
      field.multiselect({ name: 'tags', options: ['a', 'b', 'c'] })
    ]
    const signals = createStoreSignals(fields, { tags: ['a', 'b'] })
    expect(signals.tags.value).toEqual(['a', 'b'])
    signals.tags.value = ['c']
    expect(signals.tags.value).toEqual(['c'])
  })

  it('handles array field', () => {
    const fields = [
      field.array({
        name: 'items',
        fields: [field.text({ name: 'sku' }), field.number({ name: 'qty' })]
      })
    ]
    const signals = createStoreSignals(fields, {
      items: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 3 }]
    })
    const items = signals.items.value as Array<{ sku: string; qty: number }>
    expect(items).toHaveLength(2)
    expect(items[0]!.sku).toBe('A')
  })

  it('handles group field', () => {
    const fields = [
      field.group({
        name: 'address',
        fields: [field.text({ name: 'city' }), field.text({ name: 'zip' })]
      })
    ]
    const signals = createStoreSignals(fields, {
      address: { city: 'NYC', zip: '10001' }
    })
    const addr = signals.address.value as { city: string; zip: string }
    expect(addr.city).toBe('NYC')
    expect(addr.zip).toBe('10001')
  })

  it('handles boolean field', () => {
    const fields = [field.boolean({ name: 'dark', default: false })]
    const signals = createStoreSignals(fields, {})
    expect(signals.dark.value).toBe(false)
    signals.dark.value = true
    expect(signals.dark.value).toBe(true)
  })

  it('handles custom field', () => {
    const fields = [
      field.custom({
        name: 'pos',
        validator: z.object({ x: z.number(), y: z.number() }),
        default: { x: 0, y: 0 }
      })
    ]
    const signals = createStoreSignals(fields, {})
    expect(signals.pos.value).toEqual({ x: 0, y: 0 })
    signals.pos.value = { x: 10, y: 20 }
    expect(signals.pos.value).toEqual({ x: 10, y: 20 })
  })

  it('handles email, url, color, slug, date, json fields', () => {
    const fields = [
      field.email({ name: 'email' }),
      field.url({ name: 'website' }),
      field.color({ name: 'accent', default: '#000' }),
      field.slug({ name: 'handle' }),
      field.date({ name: 'created' }),
      field.json({ name: 'meta' })
    ]
    const signals = createStoreSignals(fields, {
      email: 'a@b.com',
      website: 'https://example.com',
      handle: 'test',
      created: '2026-01-01',
      meta: { key: 'val' }
    })
    expect(signals.email.value).toBe('a@b.com')
    expect(signals.website.value).toBe('https://example.com')
    expect(signals.accent.value).toBe('#000')
    expect(signals.handle.value).toBe('test')
    expect(signals.created.value).toBe('2026-01-01')
    expect(signals.meta.value).toEqual({ key: 'val' })
  })

  it('handles textarea field', () => {
    const fields = [field.textarea({ name: 'bio', default: '' })]
    const signals = createStoreSignals(fields, {})
    expect(signals.bio.value).toBe('')
    signals.bio.value = 'Hello world'
    expect(signals.bio.value).toBe('Hello world')
  })

  it('all 15 field types produce signals without error', () => {
    const fields = [
      field.text({ name: 'a' }),
      field.textarea({ name: 'b' }),
      field.number({ name: 'c' }),
      field.boolean({ name: 'd' }),
      field.select({ name: 'e', options: ['x'] }),
      field.multiselect({ name: 'f', options: ['x'] }),
      field.date({ name: 'g' }),
      field.email({ name: 'h' }),
      field.url({ name: 'i' }),
      field.color({ name: 'j' }),
      field.slug({ name: 'k' }),
      field.json({ name: 'l' }),
      field.custom({ name: 'm', validator: z.string() }),
      field.array({ name: 'n', fields: [] }),
      field.group({ name: 'o', fields: [] })
    ]
    const signals = createStoreSignals(fields, {})
    expect(Object.keys(signals)).toHaveLength(15)
    for (const key of Object.keys(signals)) {
      expect(signals[key]).toBeDefined()
      expect('value' in signals[key]!).toBe(true)
    }
  })

  it('complex store: cart with items and metadata', () => {
    const fields = [
      field.array({
        name: 'items',
        fields: [
          field.text({ name: 'sku' }),
          field.number({ name: 'qty' }),
          field.number({ name: 'price' })
        ]
      }),
      field.text({ name: 'coupon' }),
      field.select({ name: 'status', options: ['open', 'checkout', 'paid'], default: 'open' })
    ]
    const signals = createStoreSignals(fields, {
      items: [{ sku: 'W1', qty: 2, price: 9.99 }],
      coupon: 'SAVE10'
    })

    expect(signals.status!.value).toBe('open')
    expect(signals.coupon!.value).toBe('SAVE10')
    const items = signals.items!.value as Array<{ sku: string }>
    expect(items[0]!.sku).toBe('W1')

    // Mutate
    signals.items!.value = [...items, { sku: 'W2', qty: 1, price: 4.99 }]
    expect((signals.items!.value as Array<{ sku: string }>)).toHaveLength(2)
  })
})
