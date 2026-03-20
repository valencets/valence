import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from './schema/registry.js'
import { isValidIdentifier } from './db/sql-sanitize.js'

export interface SchedulerHandle {
  readonly stop: () => void
}

export function startPublishScheduler (
  pool: DbPool,
  collections: CollectionRegistry,
  intervalMs: number = 60_000
): SchedulerHandle {
  const timer = setInterval(() => {
    for (const col of collections.getAll()) {
      if (!col.versions?.drafts) continue
      if (!isValidIdentifier(col.slug)) continue
      pool.sql.unsafe(
        `UPDATE "${col.slug}" SET "_status" = 'published', "publish_at" = NULL, "updated_at" = NOW() WHERE "_status" = 'draft' AND "publish_at" IS NOT NULL AND "publish_at" <= NOW() AND "deleted_at" IS NULL`,
        []
      ).catch(() => { /* scheduled publish — error is non-fatal */ })
    }
  }, intervalMs)

  return { stop: () => clearInterval(timer) }
}
