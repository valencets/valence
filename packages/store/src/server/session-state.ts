import type { StoreFieldConfig } from '../fields/store-field-types.js'
import type { StoreState, StoreValue } from '../types.js'

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
  private readonly _sessions: Map<string, StoreState>

  private constructor (fields: readonly StoreFieldConfig[]) {
    this._defaults = buildDefaults(fields)
    this._sessions = new Map()
  }

  static create (fields: readonly StoreFieldConfig[]): SessionStateHolder {
    return new SessionStateHolder(fields)
  }

  get sessionCount (): number {
    return this._sessions.size
  }

  getState (sessionId: string): StoreState {
    const existing = this._sessions.get(sessionId)
    if (existing) return cloneState(existing)
    const fresh = cloneState(this._defaults)
    this._sessions.set(sessionId, fresh)
    return cloneState(fresh)
  }

  setState (sessionId: string, state: StoreState): void {
    this._sessions.set(sessionId, cloneState(state))
  }

  clear (sessionId: string): void {
    this._sessions.delete(sessionId)
  }

  clearAll (): void {
    this._sessions.clear()
  }
}
