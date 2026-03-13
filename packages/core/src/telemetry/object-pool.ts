import { ok, err } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'
import { createEmptyIntent, IntentType, TelemetryErrorCode } from './intent-types.js'
import type { GlobalTelemetryIntent, TelemetryError } from './intent-types.js'

function isPowerOfTwo (n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

export class TelemetryObjectPool {
  readonly capacity: number
  private readonly slots: GlobalTelemetryIntent[]

  private constructor (capacity: number) {
    this.capacity = capacity
    this.slots = new Array<GlobalTelemetryIntent>(capacity)
    for (let i = 0; i < capacity; i++) {
      this.slots[i] = createEmptyIntent(`slot-${i}`)
    }
  }

  static create (capacity: number): Result<TelemetryObjectPool, TelemetryError> {
    if (!isPowerOfTwo(capacity)) {
      return err({
        code: TelemetryErrorCode.INVALID_CAPACITY,
        message: `Capacity must be a positive power of two, got ${capacity}`
      })
    }
    return ok(new TelemetryObjectPool(capacity))
  }

  getSlot (index: number): GlobalTelemetryIntent | undefined {
    return this.slots[index]
  }

  resetSlot (index: number): Result<void, TelemetryError> {
    const slot = this.slots[index]
    if (slot === undefined) {
      return err({
        code: TelemetryErrorCode.POOL_EXHAUSTED,
        message: `Slot index ${index} out of bounds`
      })
    }
    slot.timestamp = 0
    slot.type = IntentType.CLICK
    slot.targetDOMNode = ''
    slot.x_coord = 0
    slot.y_coord = 0
    slot.isDirty = false
    slot.site_id = ''
    slot.business_type = 'other'
    return ok(undefined)
  }

  resetAll (): void {
    for (let i = 0; i < this.capacity; i++) {
      const slot = this.slots[i]!
      slot.timestamp = 0
      slot.type = IntentType.CLICK
      slot.targetDOMNode = ''
      slot.x_coord = 0
      slot.y_coord = 0
      slot.isDirty = false
      slot.site_id = ''
      slot.business_type = 'other'
    }
  }
}
