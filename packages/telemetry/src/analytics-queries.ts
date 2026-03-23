import { ResultAsync } from '@valencets/resultkit'
import { mapPostgresError } from '@valencets/db'
import type { DbError, DbPool } from '@valencets/db'

export interface CategoryCount {
  readonly dom_target: string
  readonly count: number
}

export interface PageviewCount {
  readonly path: string
  readonly views: number
}

export interface EventCategorySummary {
  readonly event_category: string
  readonly count: number
}

export interface DailyEventCount {
  readonly day: string
  readonly event_category: string
  readonly dom_target: string
  readonly count: number
}

/**
 * Get all event categories and their total counts for a time range.
 * Auto-discovers whatever categories exist in the data.
 */
export function getEventCategorySummaries (
  pool: DbPool,
  start: Date,
  end: Date
): ResultAsync<ReadonlyArray<EventCategorySummary>, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<EventCategorySummary[]>`
      SELECT event_category, COUNT(*)::int AS count
      FROM events
      WHERE created_at BETWEEN ${start} AND ${end}
      GROUP BY event_category
      ORDER BY count DESC
    `,
    mapPostgresError
  ).map((rows) => rows as ReadonlyArray<EventCategorySummary>)
}

/**
 * Get event counts by dom_target for a specific event_category or array of categories.
 * Generic — pass any category or array of categories.
 */
export function getEventCountsByCategory (
  pool: DbPool,
  category: string | string[],
  start: Date,
  end: Date
): ResultAsync<ReadonlyArray<CategoryCount>, DbError> {
  const categories = Array.isArray(category) ? category : [category]
  return ResultAsync.fromPromise(
    pool.sql<CategoryCount[]>`
      SELECT dom_target, COUNT(*)::int AS count
      FROM events
      WHERE event_category = ANY(${pool.sql.array(categories)})
        AND created_at BETWEEN ${start} AND ${end}
      GROUP BY dom_target
      ORDER BY count DESC
    `,
    mapPostgresError
  ).map((rows) => rows as ReadonlyArray<CategoryCount>)
}

/**
 * Get pageview counts grouped by path.
 * Queries events where event_category = 'PAGEVIEW'.
 */
export function getPageviewsByPath (
  pool: DbPool,
  start: Date,
  end: Date,
  limit = 20
): ResultAsync<ReadonlyArray<PageviewCount>, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<PageviewCount[]>`
      SELECT payload->>'path' AS path, COUNT(*)::int AS views
      FROM events
      WHERE event_category = 'PAGEVIEW'
        AND created_at BETWEEN ${start} AND ${end}
      GROUP BY payload->>'path'
      ORDER BY views DESC
      LIMIT ${limit}
    `,
    mapPostgresError
  ).map((rows) => rows as ReadonlyArray<PageviewCount>)
}

function queryDailyEventCounts (
  pool: DbPool,
  start: Date,
  end: Date,
  categories: string[]
): Promise<DailyEventCount[]> {
  return pool.sql<DailyEventCount[]>`
    SELECT DATE(created_at)::text AS day,
      event_category,
      dom_target,
      COUNT(*)::int AS count
    FROM events
    WHERE created_at BETWEEN ${start} AND ${end}
      AND event_category = ANY(${pool.sql.array(categories)})
    GROUP BY DATE(created_at), event_category, dom_target
    ORDER BY day DESC, count DESC
  `
}

function queryDailyEventCountsAll (
  pool: DbPool,
  start: Date,
  end: Date
): Promise<DailyEventCount[]> {
  return pool.sql<DailyEventCount[]>`
    SELECT DATE(created_at)::text AS day,
      event_category,
      dom_target,
      COUNT(*)::int AS count
    FROM events
    WHERE created_at BETWEEN ${start} AND ${end}
    GROUP BY DATE(created_at), event_category, dom_target
    ORDER BY day DESC, count DESC
  `
}

/**
 * Get daily event counts grouped by category and dom_target.
 * Generic — works for any event categories, no hardcoded dom_targets.
 * If categories are provided and non-empty, filters to those categories; otherwise returns all.
 * Note: an empty array is treated the same as no filter (returns all categories).
 * This is intentional — callers who want zero results should not call this function.
 */
export function getDailyEventCounts (
  pool: DbPool,
  start: Date,
  end: Date,
  categories?: string[]
): ResultAsync<ReadonlyArray<DailyEventCount>, DbError> {
  const query = (categories !== undefined && categories.length > 0)
    ? queryDailyEventCounts(pool, start, end, categories)
    : queryDailyEventCountsAll(pool, start, end)
  return ResultAsync.fromPromise(query, mapPostgresError)
    .map((rows) => rows as ReadonlyArray<DailyEventCount>)
}
