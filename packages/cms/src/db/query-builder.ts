import { ResultAsync, errAsync } from 'neverthrow'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { WhereOperator, PaginatedResult, SqlValue } from './query-types.js'

export interface DocumentRow {
  readonly id: string
  readonly created_at?: string | undefined
  readonly updated_at?: string | undefined
  readonly deleted_at?: string | null | undefined
  readonly [key: string]: SqlValue | undefined
}

export interface DocumentData {
  readonly [key: string]: SqlValue
}

interface WhereEntry {
  readonly field: string
  readonly operator: WhereOperator
  readonly value: SqlValue
}

interface QueryState {
  readonly slug: string
  readonly wheres: readonly WhereEntry[]
  readonly orderBys: readonly { field: string, direction: 'asc' | 'desc' }[]
  readonly limitVal: number | null
  readonly offsetVal: number | null
  readonly includeDeleted: boolean
}

const OPERATOR_SQL: Record<WhereOperator, string> = {
  equals: '=',
  not_equals: '!=',
  greater_than: '>',
  less_than: '<',
  greater_than_or_equal: '>=',
  less_than_or_equal: '<=',
  like: 'LIKE',
  in: '= ANY',
  exists: 'IS NOT NULL'
}

function buildWhereSql (state: QueryState): string {
  const parts: string[] = []

  if (!state.includeDeleted) {
    parts.push('deleted_at IS NULL')
  }

  for (const w of state.wheres) {
    const op = OPERATOR_SQL[w.operator]
    if (w.operator === 'exists') {
      parts.push(`"${w.field}" ${w.value ? 'IS NOT NULL' : 'IS NULL'}`)
    } else if (w.operator === 'in') {
      parts.push(`"${w.field}" = ANY($${parts.length + 1})`)
    } else {
      parts.push(`"${w.field}" ${op} $${parts.length + 1}`)
    }
  }

  return parts.length > 0 ? ` WHERE ${parts.join(' AND ')}` : ''
}

function buildOrderSql (state: QueryState): string {
  if (state.orderBys.length === 0) return ''
  const parts = state.orderBys.map(o => `"${o.field}" ${o.direction.toUpperCase()}`)
  return ` ORDER BY ${parts.join(', ')}`
}

function buildLimitOffsetSql (state: QueryState): string {
  let sql = ''
  if (state.limitVal !== null) sql += ` LIMIT ${state.limitVal}`
  if (state.offsetVal !== null) sql += ` OFFSET ${state.offsetVal}`
  return sql
}

function getWhereValues (state: QueryState): SqlValue[] {
  return state.wheres
    .filter(w => w.operator !== 'exists')
    .map(w => w.value)
}

function executeQuery<T> (
  pool: DbPool,
  queryStr: string,
  params: SqlValue[]
): ResultAsync<T, CmsError> {
  return ResultAsync.fromPromise(
    pool.sql(queryStr as never, ...params as never[]).then((rows) => rows as T),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INTERNAL,
      message: e instanceof Error ? e.message : 'Query failed'
    })
  )
}

export interface CollectionQueryBuilder {
  where (field: string, value: SqlValue): CollectionQueryBuilder
  where (field: string, operator: WhereOperator, value: SqlValue): CollectionQueryBuilder
  orderBy (field: string, direction: 'asc' | 'desc'): CollectionQueryBuilder
  limit (n: number): CollectionQueryBuilder
  offset (n: number): CollectionQueryBuilder
  withDeleted (): CollectionQueryBuilder
  all<T = DocumentRow> (): ResultAsync<T[], CmsError>
  first<T = DocumentRow> (): ResultAsync<T | null, CmsError>
  count (): ResultAsync<number, CmsError>
  insert<T = DocumentRow> (data: DocumentData): ResultAsync<T, CmsError>
  update<T = DocumentRow> (data: DocumentData): ResultAsync<T, CmsError>
  delete<T = DocumentRow> (): ResultAsync<T, CmsError>
  page<T = DocumentRow> (pageNum: number, perPage: number): ResultAsync<PaginatedResult<T>, CmsError>
}

function createBuilder (
  pool: DbPool,
  registry: CollectionRegistry,
  state: QueryState
): CollectionQueryBuilder {
  function guardSlug (): CmsError | null {
    const result = registry.get(state.slug)
    if (result.isErr()) return result.error
    return null
  }

  function whereImpl (fieldOrName: string, operatorOrValue: SqlValue | WhereOperator, maybeValue?: SqlValue): CollectionQueryBuilder {
    const hasOperator = maybeValue !== undefined
    const operator: WhereOperator = hasOperator ? operatorOrValue as WhereOperator : 'equals'
    const value: SqlValue = hasOperator ? maybeValue : operatorOrValue as SqlValue
    return createBuilder(pool, registry, {
      ...state,
      wheres: [...state.wheres, { field: fieldOrName, operator, value }]
    })
  }

  return {
    where: whereImpl as CollectionQueryBuilder['where'],

    orderBy (f, direction) {
      return createBuilder(pool, registry, {
        ...state,
        orderBys: [...state.orderBys, { field: f, direction }]
      })
    },

    limit (n) {
      return createBuilder(pool, registry, { ...state, limitVal: n })
    },

    offset (n) {
      return createBuilder(pool, registry, { ...state, offsetVal: n })
    },

    withDeleted () {
      return createBuilder(pool, registry, { ...state, includeDeleted: true })
    },

    all<T> () {
      const err = guardSlug()
      if (err) return errAsync(err)
      const where = buildWhereSql(state)
      const order = buildOrderSql(state)
      const limitOffset = buildLimitOffsetSql(state)
      const query = `SELECT * FROM "${state.slug}"${where}${order}${limitOffset}`
      const params = getWhereValues(state)
      return executeQuery<T[]>(pool, query, params)
    },

    first<T> () {
      const err = guardSlug()
      if (err) return errAsync(err)
      const where = buildWhereSql(state)
      const order = buildOrderSql(state)
      const query = `SELECT * FROM "${state.slug}"${where}${order} LIMIT 1`
      const params = getWhereValues(state)
      return executeQuery<T[]>(pool, query, params)
        .map((rows: T[]) => (rows[0] as T | undefined) ?? null)
    },

    count () {
      const err = guardSlug()
      if (err) return errAsync(err)
      const where = buildWhereSql(state)
      const query = `SELECT COUNT(*) as count FROM "${state.slug}"${where}`
      const params = getWhereValues(state)
      return executeQuery<Array<{ count: string }>>(pool, query, params)
        .map(rows => Number(rows[0]?.count ?? 0))
    },

    insert<T> (data: DocumentData) {
      const err = guardSlug()
      if (err) return errAsync(err)
      const keys = Object.keys(data)
      const cols = keys.map(k => `"${k}"`).join(', ')
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const query = `INSERT INTO "${state.slug}" (${cols}) VALUES (${placeholders}) RETURNING *`
      const params = Object.values(data)
      return executeQuery<T[]>(pool, query, params)
        .map(rows => rows[0] as T)
    },

    update<T> (data: DocumentData) {
      const err = guardSlug()
      if (err) return errAsync(err)
      const keys = Object.keys(data)
      const whereParams = getWhereValues(state)
      const setClauses = keys.map((k, i) => `"${k}" = $${whereParams.length + i + 1}`).join(', ')
      const where = buildWhereSql(state)
      const query = `UPDATE "${state.slug}" SET ${setClauses}${where} RETURNING *`
      const params = [...whereParams, ...Object.values(data)]
      return executeQuery<T[]>(pool, query, params)
        .map(rows => rows[0] as T)
    },

    delete<T> () {
      const err = guardSlug()
      if (err) return errAsync(err)
      const where = buildWhereSql(state)
      const params = getWhereValues(state)
      const query = `UPDATE "${state.slug}" SET deleted_at = NOW()${where} RETURNING *`
      return executeQuery<T[]>(pool, query, params)
        .map(rows => rows[0] as T)
    },

    page<T> (pageNum: number, perPage: number) {
      const err = guardSlug()
      if (err) return errAsync(err)
      const where = buildWhereSql(state)
      const whereParams = getWhereValues(state)
      const countQuery = `SELECT COUNT(*) as count FROM "${state.slug}"${where}`

      return executeQuery<Array<{ count: string }>>(pool, countQuery, whereParams)
        .andThen(countRows => {
          const totalDocs = Number(countRows[0]?.count ?? 0)
          const totalPages = Math.ceil(totalDocs / perPage)
          const pageOffset = (pageNum - 1) * perPage
          const order = buildOrderSql(state)
          const dataQuery = `SELECT * FROM "${state.slug}"${where}${order} LIMIT ${perPage} OFFSET ${pageOffset}`

          return executeQuery<T[]>(pool, dataQuery, whereParams)
            .map((docs): PaginatedResult<T> => ({
              docs,
              totalDocs,
              page: pageNum,
              totalPages,
              limit: perPage,
              hasNextPage: pageNum < totalPages,
              hasPrevPage: pageNum > 1
            }))
        })
    }
  }
}

export interface QueryBuilderFactory {
  query (slug: string): CollectionQueryBuilder
}

export function createQueryBuilder (pool: DbPool, registry: CollectionRegistry): QueryBuilderFactory {
  return {
    query (slug: string): CollectionQueryBuilder {
      return createBuilder(pool, registry, {
        slug,
        wheres: [],
        orderBys: [],
        limitVal: null,
        offsetVal: null,
        includeDeleted: false
      })
    }
  }
}
