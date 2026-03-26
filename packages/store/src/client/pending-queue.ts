import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import type { StoreError } from '../types.js'
import { StoreErrorCode } from '../types.js'

export interface PendingMutation {
  readonly id: number
  readonly name: string
  readonly args: Readonly<{ [key: string]: string | number | boolean | null }>
}

export class PendingQueue {
  private _nextId: number
  private readonly _entries: PendingMutation[]

  private constructor () {
    this._nextId = 1
    this._entries = []
  }

  static create (): PendingQueue {
    return new PendingQueue()
  }

  get size (): number {
    return this._entries.length
  }

  enqueue (name: string, args: Readonly<{ [key: string]: string | number | boolean | null }>): number {
    const id = this._nextId++
    this._entries.push({ id, name, args })
    return id
  }

  confirm (id: number): Result<void, StoreError> {
    const index = this._entries.findIndex(e => e.id === id)
    if (index === -1) {
      return err({
        code: StoreErrorCode.MUTATION_FAILED,
        message: `No pending mutation with ID ${id}`
      })
    }
    this._entries.splice(index, 1)
    return ok(undefined)
  }

  reject (id: number): Result<void, StoreError> {
    const index = this._entries.findIndex(e => e.id === id)
    if (index === -1) {
      return err({
        code: StoreErrorCode.MUTATION_FAILED,
        message: `No pending mutation with ID ${id}`
      })
    }
    this._entries.splice(index, 1)
    return ok(undefined)
  }

  pending (): readonly PendingMutation[] {
    return [...this._entries]
  }

  clear (): void {
    this._entries.length = 0
  }
}
