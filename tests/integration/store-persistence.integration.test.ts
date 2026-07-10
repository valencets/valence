import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createPool, closePool } from '@valencets/db'
import type { DbPool } from '@valencets/db'
import { field, store } from '@valencets/store'
import { PostgresStateHolder, handleMutation } from '@valencets/store/server'
import type { StorePool } from '@valencets/store/server'
import { createAdminSql, getTestDbConfig } from './db-helpers.js'

const TEST_DB = 'valence_store_persistence_test'

const STORE_STATES_DDL = `CREATE TABLE IF NOT EXISTS store_states (
  store_slug TEXT NOT NULL,
  state_key TEXT NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (store_slug, state_key)
)`

let pool: DbPool
let storePool: StorePool

function counterConfig () {
  const result = store({
    slug: 'counter',
    scope: 'user',
    fields: [
      field.number({ name: 'count', default: 0 }),
      field.text({ name: 'label', default: 'fresh' })
    ],
    mutations: {
      increment: {
        input: [field.number({ name: 'amount', required: true })],
        server: async ({ state, input }) => {
          state.count = Number(state.count ?? 0) + Number(input.amount)
          state.label = 'touched'
        }
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

beforeAll(async () => {
  const adminSql = createAdminSql()
  await adminSql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
  `
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`)
  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB}`)
  await adminSql.end()

  pool = createPool({ ...getTestDbConfig(TEST_DB), max: 5 })
  await pool.sql.unsafe(STORE_STATES_DDL)

  // The exact adapter shape valence's maybeRegisterStores builds — a flat
  // params array through sql.unsafe against the real driver (#333).
  storePool = {
    query: async (text, params = []) => {
      return await pool.sql.unsafe(text, [...params])
    }
  }
}, 60_000)

afterAll(async () => {
  await closePool(pool)
  const adminSql = createAdminSql()
  await adminSql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
  `
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`)
  await adminSql.end()
})

describe('PostgresStateHolder against a real driver', () => {
  it('stores state as a queryable jsonb object, not a double-encoded string', async () => {
    const holder = PostgresStateHolder.create({ pool: storePool, slug: 'probe', fields: counterConfig().fields })

    await holder.setState('key-1', { count: 5, label: 'written' })

    const rows = await pool.sql.unsafe(
      "SELECT jsonb_typeof(state) AS kind, state ->> 'label' AS label FROM store_states WHERE store_slug = 'probe'"
    )
    expect(rows[0]?.kind).toBe('object')
    expect(rows[0]?.label).toBe('written')

    const readBack = await holder.getState('key-1')
    expect(readBack.count).toBe(5)
    expect(readBack.label).toBe('written')
  })

  it('accumulates mutations across the postgres round-trip', async () => {
    const config = counterConfig()
    const holder = PostgresStateHolder.create({ pool: storePool, slug: config.slug, fields: config.fields })
    const session = { id: 'sess-int', userId: 'user-int' }

    const first = await handleMutation(config, holder, 'user:user-int', 'increment', { amount: 4 }, storePool, session)
    expect(first.isOk()).toBe(true)
    if (first.isOk()) expect(first.value.state.count).toBe(4)

    const second = await handleMutation(config, holder, 'user:user-int', 'increment', { amount: 5 }, storePool, session)
    expect(second.isOk()).toBe(true)
    if (second.isOk()) {
      expect(second.value.state.count).toBe(9)
      expect(second.value.state.label).toBe('touched')
    }
  })

  it('server fns can read app tables through the same pool contract', async () => {
    await pool.sql.unsafe('CREATE TABLE IF NOT EXISTS lookup (slug TEXT PRIMARY KEY, payload JSONB)')
    await pool.sql.unsafe("INSERT INTO lookup VALUES ('hard', '{\"factor\": 2}') ON CONFLICT (slug) DO NOTHING")

    const rows = await storePool.query('SELECT payload FROM lookup WHERE slug = $1', ['hard'])
    const first = rows[0] as { payload?: { factor?: number } }
    expect(first.payload?.factor).toBe(2)
  })
})
