import { describe, it, expect } from 'vitest'
import { SERVICES_COPY_MAP } from '../config/services-copy-map.js'

const BANNED_HARDWARE_BRANDS = [
  'Intel',
  'N100',
  'NVMe',
  'WD Red',
  'Raspberry Pi',
  'ZimaBoard'
]

describe('SERVICES_COPY_MAP', () => {
  it('has entries', () => {
    expect(SERVICES_COPY_MAP.length).toBeGreaterThan(0)
  })

  it('every entry has non-empty id, default, and technical', () => {
    for (const entry of SERVICES_COPY_MAP) {
      expect(entry.id.length).toBeGreaterThan(0)
      expect(entry.default.length).toBeGreaterThan(0)
      expect(entry.technical.length).toBeGreaterThan(0)
    }
  })

  it('has unique IDs', () => {
    const ids = SERVICES_COPY_MAP.map(e => e.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })

  it('default copy contains no hardware brand names', () => {
    for (const entry of SERVICES_COPY_MAP) {
      for (const brand of BANNED_HARDWARE_BRANDS) {
        expect(entry.default).not.toContain(brand)
      }
    }
  })
})
