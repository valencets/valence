import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { TelemetryErrorCode, resetIntent } from './intent-types.js'
import type { IntentType, GlobalTelemetryIntent, TelemetryError } from './intent-types.js'
import { TelemetryObjectPool } from './object-pool.js'

export class TelemetryRingBuffer {
  readonly capacity: number
  private readonly pool: TelemetryObjectPool
  private readonly mask: number
  private readonly _dirtyBuffer: GlobalTelemetryIntent[]
  private _head: number
  private _tail: number
  private _count: number

  private constructor (pool: TelemetryObjectPool) {
    this.capacity = pool.capacity
    this.pool = pool
    this.mask = pool.capacity - 1
    this._dirtyBuffer = new Array<GlobalTelemetryIntent>(pool.capacity)
    this._head = 0
    this._tail = 0
    this._count = 0
  }

  static create (capacity: number): Result<TelemetryRingBuffer, TelemetryError> {
    const poolResult = TelemetryObjectPool.create(capacity)
    if (poolResult.isErr()) {
      return err(poolResult.error)
    }
    return ok(new TelemetryRingBuffer(poolResult.value))
  }

  write (
    type: IntentType,
    targetDOMNode: string,
    x: number,
    y: number,
    timestamp: number
  ): Result<GlobalTelemetryIntent, TelemetryError> {
    if (this._count === this.capacity) {
      // Buffer full -- overwrite oldest, advance tail
      this._tail = (this._tail + 1) & this.mask
      this._count--
    }

    const slot = this.pool.getSlot(this._head)
    if (!slot) {
      return err({
        code: TelemetryErrorCode.INVALID_SLOT_INDEX,
        message: `Head index ${this._head} returned no slot`
      })
    }

    // Reset slot to clear stale fields from previous occupant
    resetIntent(slot)
    slot.timestamp = timestamp
    slot.type = type
    slot.targetDOMNode = targetDOMNode
    slot.x_coord = x
    slot.y_coord = y
    slot.isDirty = true

    this._head = (this._head + 1) & this.mask
    this._count++

    return ok(slot)
  }

  collectDirty (): ReadonlyArray<GlobalTelemetryIntent> {
    let writeIdx = 0
    let cursor = this._tail
    for (let i = 0; i < this._count; i++) {
      const slot = this.pool.getSlot(cursor)
      if (slot && slot.isDirty) {
        this._dirtyBuffer[writeIdx++] = slot
      }
      cursor = (cursor + 1) & this.mask
    }
    this._dirtyBuffer.length = writeIdx
    return this._dirtyBuffer
  }

  markFlushed (count: number): Result<number, TelemetryError> {
    if (count > this._count) {
      return err({
        code: TelemetryErrorCode.FLUSH_OVERFLOW,
        message: `Cannot flush ${count} entries, only ${this._count} active`
      })
    }

    for (let i = 0; i < count; i++) {
      const resetResult = this.pool.resetSlot(this._tail)
      if (resetResult.isErr()) return err(resetResult.error)
      this._tail = (this._tail + 1) & this.mask
    }
    this._count -= count

    return ok(this._tail)
  }

  get head (): number {
    return this._head
  }

  get tail (): number {
    return this._tail
  }

  get count (): number {
    return this._count
  }

  get isFull (): boolean {
    return this._count === this.capacity
  }

  slotAt (index: number): GlobalTelemetryIntent | undefined {
    return this.pool.getSlot(index)
  }
}
