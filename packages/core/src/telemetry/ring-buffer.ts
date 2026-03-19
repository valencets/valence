import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import { TelemetryErrorCode } from './intent-types.js'
import type { IntentType, GlobalTelemetryIntent, TelemetryError } from './intent-types.js'
import { TelemetryObjectPool } from './object-pool.js'

export class TelemetryRingBuffer {
  readonly capacity: number
  private readonly pool: TelemetryObjectPool
  private readonly mask: number
  private _head: number
  private _tail: number
  private _count: number

  private constructor (pool: TelemetryObjectPool) {
    this.capacity = pool.capacity
    this.pool = pool
    this.mask = pool.capacity - 1
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

    const slot = this.pool.getSlot(this._head)!
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
    const result: GlobalTelemetryIntent[] = []
    let cursor = this._tail
    for (let i = 0; i < this._count; i++) {
      const slot = this.pool.getSlot(cursor)!
      if (slot.isDirty) {
        result.push(slot)
      }
      cursor = (cursor + 1) & this.mask
    }
    return result
  }

  markFlushed (count: number): Result<number, TelemetryError> {
    if (count > this._count) {
      return err({
        code: TelemetryErrorCode.BUFFER_FULL,
        message: `Cannot flush ${count} entries, only ${this._count} active`
      })
    }

    for (let i = 0; i < count; i++) {
      this.pool.resetSlot(this._tail)
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
