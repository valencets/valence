import type { StoreFieldConfig } from '../fields/store-field-types.js'
import type { StoreState, StoreValue, MutationPool } from '../types.js'
import type { StateBackend } from './state-backend.js'
import type { StorePool } from './store-routes.js'

const SELECT_STATE = 'SELECT state FROM store_states WHERE store_slug = $1 AND state_key = $2 AND deleted_at IS NULL'

// The state travels as a JSON text parameter. Drivers that infer json for
// the parameter (postgres.js) deliver it as a jsonb *string*; drivers that
// send plain text deliver an object after the cast. `#>> '{}'` unwraps the
// string case and round-trips the object case, so both land as real jsonb
// objects — queryable, never double-encoded.
const UPSERT_STATE = `INSERT INTO store_states (store_slug, state_key, state, updated_at)
VALUES ($1, $2, ($3::jsonb #>> '{}')::jsonb, NOW())
ON CONFLICT (store_slug, state_key)
DO UPDATE SET state = EXCLUDED.state, updated_at = NOW(), deleted_at = NULL`

// #336 — the locked read-modify-write rides three statements on ONE
// transaction connection: ensure the row exists so first contact has
// something to lock, take the row lock, then write in place. Concurrent
// nodes queue on the FOR UPDATE lock instead of interleaving.
const ENSURE_ROW = `INSERT INTO store_states (store_slug, state_key, state, updated_at)
VALUES ($1, $2, ($3::jsonb #>> '{}')::jsonb, NOW())
ON CONFLICT (store_slug, state_key) DO NOTHING`

const SELECT_STATE_FOR_UPDATE = 'SELECT state FROM store_states WHERE store_slug = $1 AND state_key = $2 AND deleted_at IS NULL FOR UPDATE'

const LOCKED_WRITE = `UPDATE store_states
SET state = ($3::jsonb #>> '{}')::jsonb, updated_at = NOW(), deleted_at = NULL
WHERE store_slug = $1 AND state_key = $2`

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

interface PostgresStateHolderConfig {
  readonly pool: StorePool
  readonly slug: string
  readonly fields: readonly StoreFieldConfig[]
}

/**
 * Postgres-backed state for user-scoped stores: one row per (store, state
 * key) in the store_states table, so state follows the user across
 * sessions, devices, and server restarts. All values travel in the
 * `params` array — keys and state never interpolate into SQL.
 *
 * Serialization note: the in-process mutation lock covers a single node;
 * multi-process deployments need row-level locking before sharing a store
 * across instances.
 */
function extractState (rows: readonly unknown[]): StoreState | null {
  const first = rows[0]
  if (first !== null && first !== undefined && typeof first === 'object' && 'state' in first) {
    const stored = (first as { state: StoreValue }).state
    if (stored !== null && typeof stored === 'object' && !Array.isArray(stored)) {
      return { ...(stored as StoreState) }
    }
  }
  return null
}

export class PostgresStateHolder implements StateBackend {
  private readonly _pool: StorePool
  private readonly _slug: string
  private readonly _defaults: StoreState
  /** Row-locked read-modify-write — present only when the pool can open transactions (#336). */
  readonly update?: (key: string, mutate: (state: StoreState) => Promise<StoreState>) => Promise<StoreState>

  private constructor (config: PostgresStateHolderConfig) {
    this._pool = config.pool
    this._slug = config.slug
    this._defaults = buildDefaults(config.fields)

    const transaction = config.pool.transaction
    if (transaction !== undefined) {
      this.update = async (key, mutate) => await this._lockedUpdate(transaction, key, mutate)
    }
  }

  static create (config: PostgresStateHolderConfig): PostgresStateHolder {
    return new PostgresStateHolder(config)
  }

  private async _lockedUpdate (
    transaction: NonNullable<StorePool['transaction']>,
    key: string,
    mutate: (state: StoreState) => Promise<StoreState>
  ): Promise<StoreState> {
    return await transaction(async (tx: MutationPool) => {
      await tx.query(ENSURE_ROW, [this._slug, key, JSON.stringify(this._defaults)])
      const rows = await tx.query(SELECT_STATE_FOR_UPDATE, [this._slug, key])
      const current = extractState(rows) ?? JSON.parse(JSON.stringify(this._defaults)) as StoreState
      const next = await mutate(current)
      await tx.query(LOCKED_WRITE, [this._slug, key, JSON.stringify(next)])
      return next
    })
  }

  async getState (key: string): Promise<StoreState> {
    const rows = await this._pool.query(SELECT_STATE, [this._slug, key])
    const stored = extractState(rows)
    if (stored !== null) {
      return stored
    }
    return JSON.parse(JSON.stringify(this._defaults)) as StoreState
  }

  async setState (key: string, state: StoreState): Promise<void> {
    await this._pool.query(UPSERT_STATE, [this._slug, key, JSON.stringify(state)])
  }
}
