import { describe, it, expect } from 'vitest'
import * as store from '../index.js'

// #337 — `field` exists in both @valencets/cms and @valencets/store with
// different config types. Files importing both (every valence.config.ts
// with collections AND stores) had to alias by hand; the package now ships
// the documented alias itself.

describe('store field export naming', () => {
  it('exports storeField as a first-class alias of field', () => {
    expect(store.storeField).toBe(store.field)
    expect(typeof store.storeField.text).toBe('function')
    expect(typeof store.storeField.array).toBe('function')
  })
})
