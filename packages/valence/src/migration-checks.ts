import { ResultAsync } from '@valencets/resultkit'
import type { DbPool } from '@valencets/db'

const CAMEL_CASE_SYSTEM_COLS = ['createdAt', 'updatedAt', 'deletedAt'] as const

/**
 * Best-effort post-migration lint (#351): warn about the schema mistakes
 * the CMS trips over most — camelCase system columns and missing
 * `deleted_at` (soft delete). Must run on a LIVE pool, before closePool;
 * failures resolve silently because a broken information_schema query must
 * never fail a successful migration run.
 */
export function validateColumnNaming (pool: DbPool, log: (msg: string) => void): Promise<void> {
  return ResultAsync.fromPromise(
    (async () => {
      const tables = await pool.sql.unsafe(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
      )
      for (const t of tables) {
        const tableName = String(Reflect.get(t, 'table_name') ?? '')
        const cols = await pool.sql.unsafe(
          "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
          [tableName]
        )
        const colNames = Array.from(cols).map(c => String(Reflect.get(c, 'column_name') ?? ''))
        for (const bad of CAMEL_CASE_SYSTEM_COLS) {
          if (colNames.includes(bad)) {
            const snakeVersion = bad.replace(/([A-Z])/g, '_$1').toLowerCase()
            log(`  ⚠ Table "${tableName}" has "${bad}" — CMS expects "${snakeVersion}". Run: ALTER TABLE "${tableName}" RENAME COLUMN "${bad}" TO ${snakeVersion};`)
          }
        }
        if (!colNames.includes('deleted_at') && colNames.includes('created_at')) {
          log(`  ⚠ Table "${tableName}" is missing "deleted_at" column — CMS soft-delete will not work.`)
        }
      }
    })(),
    () => null
  ).match(
    () => undefined,
    () => undefined
  )
}
