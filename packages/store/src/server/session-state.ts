import type { StoreFieldConfig } from '../fields/store-field-types.js'
import type { StoreState, StoreValue } from '../types.js'

const DEFAULT_MAX_SESSIONS = 1000

export interface SessionStateOptions {
  /** Upper bound on distinct session buckets — least-recently-used entries evict beyond it */
  readonly maxSessions?: number
}

function resolveDefault (field: StoreFieldConfig): StoreValue {
  if ('default' in field && field.default !== undefined) {
    return field.default as StoreValue
  }
  return undefined
}

function buildDefaults (fields: readonly StoreFieldConfig[]): StoreState {
  const state: StoreState = {}
  for (const f of fields) {
    state[f.name] = resolveDefault(f)
  }
  return state
}

function cloneState (state: StoreState): StoreState {
  return JSON.parse(JSON.stringify(state)) as StoreState
}

export class SessionStateHolder {
  private readonly _defaults: StoreState
  // Map iteration order doubles as the LRU order: touched entries are
  // re-inserted at the tail, evictions pop the head. Session ids are
  // client-supplied, so an unbounded map is a memory-DoS vector.
  private readonly _sessions: Map<string, StoreState>
  private readonly _maxSessions: number

  private constructor (fields: readonly StoreFieldConfig[], options?: SessionStateOptions) {
    this._defaults = buildDefaults(fields)
    this._sessions = new Map()
    this._maxSessions = options?.maxSessions ?? DEFAULT_MAX_SESSIONS
  }

  static create (fields: readonly StoreFieldConfig[], options?: SessionStateOptions): SessionStateHolder {
    return new SessionStateHolder(fields, options)
  }

  get sessionCount (): number {
    return this._sessions.size
  }

  private _touch (sessionId: string, state: StoreState): void {
    this._sessions.delete(sessionId)
    this._sessions.set(sessionId, state)
    if (this._sessions.size > this._maxSessions) {
      const oldest = this._sessions.keys().next()
      if (!oldest.done) {
        this._sessions.delete(oldest.value)
      }
    }
  }

  getState (sessionId: string): StoreState {
    const existing = this._sessions.get(sessionId)
    if (existing) {
      this._touch(sessionId, existing)
      return cloneState(existing)
    }
    const fresh = cloneState(this._defaults)
    this._touch(sessionId, fresh)
    return cloneState(fresh)
  }

  setState (sessionId: string, state: StoreState): void {
    this._touch(sessionId, cloneState(state))
  }

  clear (sessionId: string): void {
    this._sessions.delete(sessionId)
  }

  clearAll (): void {
    this._sessions.clear()
  }
}
