import { describe, it, expect } from 'vitest'
import { field } from '../fields/index.js'
import { SessionStateHolder } from '../server/session-state.js'
import { toStoreValue } from '../types.js'
import type { StoreValue } from '../types.js'

interface Crewmate {
  readonly name: string
  readonly admin: boolean
  readonly slots: number
}

const DEFAULT_CREW: readonly Crewmate[] = [
  { name: 'Ada', admin: true, slots: 2 },
  { name: 'Grace', admin: false, slots: 0 }
]

describe('array and group field defaults', () => {
  it('array fields carry a default list into fresh state', () => {
    const holder = SessionStateHolder.create([
      field.array({
        name: 'crew',
        default: toStoreValue(DEFAULT_CREW),
        fields: [
          field.text({ name: 'name' }),
          field.boolean({ name: 'admin' }),
          field.number({ name: 'slots' })
        ]
      })
    ])

    const state = holder.getState('s-1')
    expect(state.crew).toEqual(DEFAULT_CREW)
  })

  it('group fields carry a default object into fresh state', () => {
    const holder = SessionStateHolder.create([
      field.group({
        name: 'limits',
        default: { maxPlayers: 16, hardcore: false },
        fields: [
          field.number({ name: 'maxPlayers' }),
          field.boolean({ name: 'hardcore' })
        ]
      })
    ])

    const state = holder.getState('s-1')
    expect(state.limits).toEqual({ maxPlayers: 16, hardcore: false })
  })

  it('sessions get independent clones of array defaults', () => {
    const holder = SessionStateHolder.create([
      field.array({
        name: 'crew',
        default: toStoreValue(DEFAULT_CREW),
        fields: [field.text({ name: 'name' })]
      })
    ])

    const first = holder.getState('s-1')
    ;(first.crew as Array<{ name: string }>).push({ name: 'Intruder' })
    holder.setState('s-1', first)

    const second = holder.getState('s-2')
    expect((second.crew as unknown[]).length).toBe(2)
  })
})

describe('toStoreValue', () => {
  it('is an identity at runtime and accepts JSON-compatible interfaces at compile time', () => {
    const value: StoreValue = toStoreValue(DEFAULT_CREW)
    expect(value).toBe(DEFAULT_CREW)

    const nested = toStoreValue({ crew: DEFAULT_CREW, motd: 'welcome' })
    expect(nested).toEqual({ crew: DEFAULT_CREW, motd: 'welcome' })
  })
})
