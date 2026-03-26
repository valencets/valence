import { describe, it, expect } from 'vitest'
import { SessionStateHolder } from '../server/session-state.js'
import { field } from '../fields/index.js'

describe('SessionStateHolder', () => {
  const fields = [
    field.text({ name: 'title', default: 'untitled' }),
    field.number({ name: 'count', default: 0 }),
    field.boolean({ name: 'active', default: true }),
    field.select({ name: 'status', options: ['draft', 'published'], default: 'draft' })
  ]

  it('getState returns defaults for new session', () => {
    const holder = SessionStateHolder.create(fields)
    const state = holder.getState('session-1')
    expect(state.title).toBe('untitled')
    expect(state.count).toBe(0)
    expect(state.active).toBe(true)
    expect(state.status).toBe('draft')
  })

  it('fields without default start as undefined', () => {
    const holder = SessionStateHolder.create([
      field.text({ name: 'name' }),
      field.number({ name: 'age' })
    ])
    const state = holder.getState('s1')
    expect(state.name).toBeUndefined()
    expect(state.age).toBeUndefined()
  })

  it('different sessions have isolated state', () => {
    const holder = SessionStateHolder.create(fields)
    const state1 = holder.getState('s1')
    state1.count = 42
    holder.setState('s1', state1)

    const state2 = holder.getState('s2')
    expect(state2.count).toBe(0) // default: 0 was specified in field config
  })

  it('setState persists and getState retrieves', () => {
    const holder = SessionStateHolder.create(fields)
    holder.setState('s1', { title: 'hello', count: 10, active: false, status: 'published' })
    const state = holder.getState('s1')
    expect(state.title).toBe('hello')
    expect(state.count).toBe(10)
    expect(state.active).toBe(false)
    expect(state.status).toBe('published')
  })

  it('getState returns a copy, not the internal reference', () => {
    const holder = SessionStateHolder.create(fields)
    const a = holder.getState('s1')
    const b = holder.getState('s1')
    expect(a).not.toBe(b)
    expect(a).toEqual(b)
  })

  it('clear removes a session state', () => {
    const holder = SessionStateHolder.create(fields)
    holder.setState('s1', { title: 'test', count: 5, active: true, status: 'draft' })
    holder.clear('s1')
    const state = holder.getState('s1')
    expect(state.count).toBe(0) // back to field default
    expect(state.title).toBe('untitled') // back to field default
  })

  it('clearAll removes all sessions', () => {
    const holder = SessionStateHolder.create(fields)
    holder.setState('s1', { title: 'a', count: 1, active: true, status: 'draft' })
    holder.setState('s2', { title: 'b', count: 2, active: true, status: 'draft' })
    holder.clearAll()
    expect(holder.getState('s1').count).toBe(0) // back to field default
    expect(holder.getState('s2').count).toBe(0) // back to field default
  })

  it('sessionCount tracks active sessions', () => {
    const holder = SessionStateHolder.create(fields)
    expect(holder.sessionCount).toBe(0)
    holder.getState('s1')
    expect(holder.sessionCount).toBe(1)
    holder.getState('s2')
    expect(holder.sessionCount).toBe(2)
    holder.clear('s1')
    expect(holder.sessionCount).toBe(1)
  })

  it('array field without default starts as undefined', () => {
    const holder = SessionStateHolder.create([
      field.array({ name: 'items', fields: [field.text({ name: 'sku' })] })
    ])
    const state = holder.getState('s1')
    expect(state.items).toBeUndefined()
  })

  it('group field without default starts as undefined', () => {
    const holder = SessionStateHolder.create([
      field.group({ name: 'address', fields: [field.text({ name: 'city' })] })
    ])
    const state = holder.getState('s1')
    expect(state.address).toBeUndefined()
  })

  it('multiselect field without default starts as undefined', () => {
    const holder = SessionStateHolder.create([
      field.multiselect({ name: 'tags', options: ['a', 'b'] })
    ])
    const state = holder.getState('s1')
    expect(state.tags).toBeUndefined()
  })

  it('handles boolean default false correctly', () => {
    const holder = SessionStateHolder.create([
      field.boolean({ name: 'hidden', default: false })
    ])
    const state = holder.getState('s1')
    expect(state.hidden).toBe(false)
  })
})
