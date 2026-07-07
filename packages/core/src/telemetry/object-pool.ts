import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { createEmptyIntent, resetIntent, TelemetryErrorCode } from './intent-types.js'
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
        code: TelemetryErrorCode.INVALID_SLOT_INDEX,
        message: `Slot index ${index} out of bounds`
      })
    }
    resetIntent(slot)
    return ok(undefined)
  }

  resetAll (): void {
    for (let i = 0; i < this.capacity; i++) {
      const slot = this.slots[i]
      if (slot) resetIntent(slot)
    }
  }
}
