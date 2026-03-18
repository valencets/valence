import { ResultAsync, errAsync } from 'neverthrow'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { WhereOperator, PaginatedResult, SqlValue } from './query-types.js'
import { isValidIdentifier, getValidFieldNames, isAllowedField } from './sql-sanitize.js'
import { safeQuery } from './safe-query.js'

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

function invalidField (name: string): CmsError {
  return { code: CmsErrorCode.INVALID_INPUT, message: `Invalid field name: ${name}` }
}

function validateFields (state: QueryState, allowedFields: Set<string>): CmsError | null {
  for (const w of state.wheres) {
    if (!isAllowedField(w.field, allowedFields)) return invalidField(w.field)
  }
  for (const o of state.orderBys) {
    if (!isAllowedField(o.field, allowedFields)) return invalidField(o.field)
  }
  return null
}

function validateDataKeys (data: DocumentData, allowedFields: Set<string>): CmsError | null {
  for (const key of Object.keys(data)) {
    if (!isAllowedField(key, allowedFields)) return invalidField(key)
  }
  return null
}

function buildWhereSql (state: QueryState): string {
  const parts: string[] = []

  if (!state.includeDeleted) {
    parts.push('"deleted_at" IS NULL')
  }

  for (const w of state.wheres) {
    const col = `"${w.field}"`
    if (w.operator === 'exists') {
      parts.push(`${col} ${w.value ? 'IS NOT NULL' : 'IS NULL'}`)
    } else if (w.operator === 'in') {
      parts.push(`${col} = ANY($${parts.length + 1})`)
    } else {
      parts.push(`${col} ${OPERATOR_SQL[w.operator]} $${parts.length + 1}`)
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
  if (state.limitVal !== null) sql += ` LIMIT ${Number(state.limitVal)}`
  if (state.offsetVal !== null) sql += ` OFFSET ${Number(state.offsetVal)}`
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
  return safeQuery<T>(pool, queryStr, params)
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
  function guard (): { error: CmsError } | { allowedFields: Set<string> } {
    if (!isValidIdentifier(state.slug)) {
      return { error: { code: CmsErrorCode.INVALID_INPUT, message: `Invalid collection slug: ${state.slug}` } }
    }
    const result = registry.get(state.slug)
    if (result.isErr()) return { error: result.error }
    const allowedFields = getValidFieldNames(result.value)
    const fieldErr = validateFields(state, allowedFields)
    if (fieldErr) return { error: fieldErr }
    return { allowedFields }
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
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `SELECT * FROM ${table}${buildWhereSql(state)}${buildOrderSql(state)}${buildLimitOffsetSql(state)}`, getWhereValues(state))
    },

    first<T> () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `SELECT * FROM ${table}${buildWhereSql(state)}${buildOrderSql(state)} LIMIT 1`, getWhereValues(state))
        .map((rows: T[]) => (rows[0] as T | undefined) ?? null)
    },

    count () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      return executeQuery<Array<{ count: string }>>(pool, `SELECT COUNT(*) as count FROM ${table}${buildWhereSql(state)}`, getWhereValues(state))
        .map(rows => Number(rows[0]?.count ?? 0))
    },

    insert<T> (data: DocumentData) {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const dataErr = validateDataKeys(data, g.allowedFields)
      if (dataErr) return errAsync(dataErr)
      const keys = Object.keys(data)
      const cols = keys.map(k => `"${k}"`).join(', ')
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`, Object.values(data))
        .map(rows => rows[0] as T)
    },

    update<T> (data: DocumentData) {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const dataErr = validateDataKeys(data, g.allowedFields)
      if (dataErr) return errAsync(dataErr)
      const keys = Object.keys(data)
      const whereParams = getWhereValues(state)
      const setClauses = keys.map((k, i) => `"${k}" = $${whereParams.length + i + 1}`).join(', ')
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `UPDATE ${table} SET ${setClauses}${buildWhereSql(state)} RETURNING *`, [...whereParams, ...Object.values(data)])
        .map(rows => rows[0] as T)
    },

    delete<T> () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `UPDATE ${table} SET "deleted_at" = NOW()${buildWhereSql(state)} RETURNING *`, getWhereValues(state))
        .map(rows => rows[0] as T)
    },

    page<T> (pageNum: number, perPage: number) {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      const where = buildWhereSql(state)
      const whereParams = getWhereValues(state)
      const safePerPage = Number(perPage)
      const safePageNum = Number(pageNum)

      return executeQuery<Array<{ count: string }>>(pool, `SELECT COUNT(*) as count FROM ${table}${where}`, whereParams)
        .andThen(countRows => {
          const totalDocs = Number(countRows[0]?.count ?? 0)
          const totalPages = Math.ceil(totalDocs / safePerPage)
          const pageOffset = (safePageNum - 1) * safePerPage

          return executeQuery<T[]>(pool, `SELECT * FROM ${table}${where}${buildOrderSql(state)} LIMIT ${safePerPage} OFFSET ${pageOffset}`, whereParams)
            .map((docs): PaginatedResult<T> => ({
              docs,
              totalDocs,
              page: safePageNum,
              totalPages,
              limit: safePerPage,
              hasNextPage: safePageNum < totalPages,
              hasPrevPage: safePageNum > 1
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
