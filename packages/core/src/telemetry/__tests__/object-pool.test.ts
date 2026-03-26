import { describe, it, expect } from 'vitest'
import { TelemetryObjectPool } from '../object-pool.js'
import { IntentType, BusinessType, CURRENT_SCHEMA_VERSION, TelemetryErrorCode } from '../intent-types.js'

describe('TelemetryObjectPool', () => {
  describe('create', () => {
    it('succeeds with valid power-of-two capacity', () => {
      const result = TelemetryObjectPool.create(1024)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.capacity).toBe(1024)
      }
    })

    it('succeeds with capacity of 1', () => {
      const result = TelemetryObjectPool.create(1)
      expect(result.isOk()).toBe(true)
    })

    it('succeeds with capacity of 2', () => {
      const result = TelemetryObjectPool.create(2)
      expect(result.isOk()).toBe(true)
    })

    it('fails with capacity 0', () => {
      const result = TelemetryObjectPool.create(0)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_CAPACITY')
      }
    })

    it('fails with negative capacity', () => {
      const result = TelemetryObjectPool.create(-1)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_CAPACITY')
      }
    })

    it('fails with non-power-of-two capacity', () => {
      const result = TelemetryObjectPool.create(100)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_CAPACITY')
      }
    })

    it('fails with capacity 3', () => {
      const result = TelemetryObjectPool.create(3)
      expect(result.isErr()).toBe(true)
    })
  })

  describe('slot initialization', () => {
    it('all slots have correct IDs', () => {
      const result = TelemetryObjectPool.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        for (let i = 0; i < 8; i++) {
          const slot = pool.getSlot(i)
          expect(slot).toBeDefined()
          expect(slot!.id).toBe(`slot-${i}`)
        }
      }
    })

    it('all slots initialized with default values', () => {
      const result = TelemetryObjectPool.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        for (let i = 0; i < 4; i++) {
          const slot = pool.getSlot(i)
          expect(slot!.timestamp).toBe(0)
          expect(slot!.type).toBe(IntentType.CLICK)
          expect(slot!.targetDOMNode).toBe('')
          expect(slot!.x_coord).toBe(0)
          expect(slot!.y_coord).toBe(0)
          expect(slot!.isDirty).toBe(false)
          expect(slot!.schema_version).toBe(CURRENT_SCHEMA_VERSION)
          expect(slot!.site_id).toBe('')
          expect(slot!.business_type).toBe(BusinessType.OTHER)
          expect(slot!.path).toBe('')
          expect(slot!.referrer).toBe('')
        }
      }
    })

    it('all slots have identical Object.keys order (monomorphism)', () => {
      const result = TelemetryObjectPool.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        const referenceKeys = Object.keys(pool.getSlot(0)!)
        for (let i = 1; i < 8; i++) {
          expect(Object.keys(pool.getSlot(i)!)).toEqual(referenceKeys)
        }
      }
    })
  })

  describe('getSlot', () => {
    it('returns same object reference on repeated calls', () => {
      const result = TelemetryObjectPool.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        const first = pool.getSlot(0)
        const second = pool.getSlot(0)
        expect(first).toBe(second)
      }
    })

    it('returns undefined for out-of-bounds index', () => {
      const result = TelemetryObjectPool.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        expect(pool.getSlot(4)).toBeUndefined()
        expect(pool.getSlot(-1)).toBeUndefined()
        expect(pool.getSlot(100)).toBeUndefined()
      }
    })
  })

  describe('resetSlot', () => {
    it('zeroes all values but preserves id', () => {
      const result = TelemetryObjectPool.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        const slot = pool.getSlot(1)!
        slot.timestamp = 12345
        slot.type = IntentType.SCROLL
        slot.targetDOMNode = 'button.cta'
        slot.x_coord = 100
        slot.y_coord = 200
        slot.isDirty = true
        slot.schema_version = 99
        slot.site_id = 'site-abc'
        slot.business_type = BusinessType.LEGAL
        slot.path = '/about'
        slot.referrer = 'https://example.com'

        const resetResult = pool.resetSlot(1)
        expect(resetResult.isOk()).toBe(true)
        expect(slot.id).toBe('slot-1')
        expect(slot.timestamp).toBe(0)
        expect(slot.type).toBe(IntentType.CLICK)
        expect(slot.targetDOMNode).toBe('')
        expect(slot.x_coord).toBe(0)
        expect(slot.y_coord).toBe(0)
        expect(slot.isDirty).toBe(false)
        expect(slot.schema_version).toBe(CURRENT_SCHEMA_VERSION)
        expect(slot.site_id).toBe('')
        expect(slot.business_type).toBe(BusinessType.OTHER)
        expect(slot.path).toBe('')
        expect(slot.referrer).toBe('')
      }
    })

    it('preserves object identity through reset', () => {
      const result = TelemetryObjectPool.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        const before = pool.getSlot(2)
        pool.resetSlot(2)
        const after = pool.getSlot(2)
        expect(before).toBe(after)
      }
    })

    it('returns Err with INVALID_SLOT_INDEX for out-of-bounds', () => {
      const result = TelemetryObjectPool.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        const resetResult = pool.resetSlot(10)
        expect(resetResult.isErr()).toBe(true)
        if (resetResult.isErr()) {
          expect(resetResult.error.code).toBe(TelemetryErrorCode.INVALID_SLOT_INDEX)
        }
      }
    })
  })

  describe('resetAll', () => {
    it('returns all slots to initial state', () => {
      const result = TelemetryObjectPool.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const pool = result.value
        for (let i = 0; i < 4; i++) {
          const slot = pool.getSlot(i)!
          slot.timestamp = 9999
          slot.isDirty = true
          slot.targetDOMNode = 'modified'
          slot.business_type = BusinessType.MEDICAL
          slot.schema_version = 42
        }

        pool.resetAll()

        for (let i = 0; i < 4; i++) {
          const slot = pool.getSlot(i)!
          expect(slot.id).toBe(`slot-${i}`)
          expect(slot.timestamp).toBe(0)
          expect(slot.isDirty).toBe(false)
          expect(slot.targetDOMNode).toBe('')
          expect(slot.business_type).toBe(BusinessType.OTHER)
          expect(slot.schema_version).toBe(CURRENT_SCHEMA_VERSION)
        }
      }
    })
  })
})
