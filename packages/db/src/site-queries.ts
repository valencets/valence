import { ResultAsync } from 'neverthrow'
import type { DbError } from './types.js'
import type { DbPool } from './connection.js'
import { mapPostgresError } from './connection.js'
import type { SiteRow, InsertableSite } from './site-types.js'

export function getSites (pool: DbPool): ResultAsync<ReadonlyArray<SiteRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<SiteRow[]>`
        SELECT * FROM sites ORDER BY name ASC
      `
      return rows as ReadonlyArray<SiteRow>
    })(),
    mapPostgresError
  )
}

export function getSiteBySlug (
  pool: DbPool,
  slug: string
): ResultAsync<SiteRow | null, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<SiteRow[]>`
        SELECT * FROM sites WHERE slug = ${slug}
      `
      return rows[0] ?? null
    })(),
    mapPostgresError
  )
}

export function upsertSite (
  pool: DbPool,
  site: InsertableSite
): ResultAsync<SiteRow, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const schemaJson = site.lead_action_schema !== null
        ? JSON.stringify(site.lead_action_schema)
        : null
      const rows = await pool.sql<SiteRow[]>`
        INSERT INTO sites (name, slug, vertical, sub_vertical, location, tier, appliance_hardware, lead_action_schema)
        VALUES (
          ${site.name}, ${site.slug}, ${site.vertical}, ${site.sub_vertical},
          ${site.location}, ${site.tier}, ${site.appliance_hardware},
          ${schemaJson}::jsonb
        )
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          vertical = EXCLUDED.vertical,
          sub_vertical = EXCLUDED.sub_vertical,
          location = EXCLUDED.location,
          tier = EXCLUDED.tier,
          appliance_hardware = EXCLUDED.appliance_hardware,
          lead_action_schema = EXCLUDED.lead_action_schema
        RETURNING *
      `
      const row = rows[0]
      if (!row) {
        return Promise.reject(new Error('UPSERT returned no rows'))
      }
      return row
    })(),
    mapPostgresError
  )
}
