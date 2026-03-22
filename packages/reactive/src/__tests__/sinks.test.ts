import { describe, it, expect } from 'vitest'
import { signal } from '../core.js'
import { fieldSink, condition } from '../sinks.js'

describe('fieldSink()', () => {
  it('creates value, visible, and error signals', () => {
    const sink = fieldSink('hello')
    expect(sink.value.value).toBe('hello')
    expect(sink.visible.value).toBe(true)
    expect(sink.error.value).toBe(null)
  })

  it('value signal is writable', () => {
    const sink = fieldSink('')
    sink.value.value = 'updated'
    expect(sink.value.value).toBe('updated')
  })

  it('visible signal is writable', () => {
    const sink = fieldSink('')
    sink.visible.value = false
    expect(sink.visible.value).toBe(false)
  })

  it('error signal accepts string or null', () => {
    const sink = fieldSink('')
    sink.error.value = 'Required'
    expect(sink.error.value).toBe('Required')
    sink.error.value = null
    expect(sink.error.value).toBe(null)
  })
})

describe('condition()', () => {
  it('returns computed boolean from signal deps', () => {
    const name = signal('hello')
    const visible = condition([name], (n) => n.length > 0)
    expect(visible.value).toBe(true)
  })

  it('updates when source signal changes', () => {
    const name = signal('hello')
    const visible = condition([name], (n) => n.length > 0)
    name.value = ''
    expect(visible.value).toBe(false)
  })

  it('supports multiple deps', () => {
    const role = signal('admin')
    const published = signal(false)
    const canEdit = condition([role, published], (r, p) => r === 'admin' || p)
    expect(canEdit.value).toBe(true)
    role.value = 'editor'
    expect(canEdit.value).toBe(false)
    published.value = true
    expect(canEdit.value).toBe(true)
  })

  it('supports non-string signal types', () => {
    const count = signal(5)
    const active = signal(true)
    const show = condition([count, active], (c, a) => c > 3 && a)
    expect(show.value).toBe(true)
    count.value = 2
    expect(show.value).toBe(false)
  })
})
