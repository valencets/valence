import { ResultAsync, errAsync } from 'neverthrow'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { WhereOperator, PaginatedResult, SqlValue } from './query-types.js'
import { isValidIdentifier, getValidFieldNames, isAllowedField } from './sql-sanitize.js'
import { safeQuery } from './safe-query.js'

const VALID_TS_LANGUAGES = new Set([
  'simple', 'arabic', 'armenian', 'basque', 'catalan', 'danish', 'dutch',
  'english', 'finnish', 'french', 'german', 'greek', 'hindi', 'hungarian',
  'indonesian', 'irish', 'italian', 'lithuanian', 'nepali', 'norwegian',
  'portuguese', 'romanian', 'russian', 'serbian', 'spanish', 'swedish',
  'tamil', 'turkish', 'yiddish'
])

function sanitizeLanguage (lang: string): string {
  return VALID_TS_LANGUAGES.has(lang) ? lang : 'english'
}

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
  readonly includeDrafts: boolean
  readonly isVersioned: boolean
  readonly searchQuery: string | null
  readonly searchLanguage: string
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

function buildSelectSql (state: QueryState, table: string): string {
  if (state.searchQuery !== null) {
    const searchParamIdx = getWhereParamCount(state) + 1
    const lang = sanitizeLanguage(state.searchLanguage)
    return `SELECT *, ts_rank(search_vector, plainto_tsquery('${lang}', $${searchParamIdx})) AS search_rank FROM ${table}`
  }
  return `SELECT * FROM ${table}`
}

function getWhereParamCount (state: QueryState): number {
  return state.wheres.filter(w => w.operator !== 'exists').length
}

function buildWhereSql (state: QueryState): string {
  const parts: string[] = []
  let paramIdx = 0

  if (!state.includeDeleted) {
    parts.push('"deleted_at" IS NULL')
  }

  if (state.isVersioned && !state.includeDrafts) {
    parts.push('"_status" = \'published\'')
  }

  for (const w of state.wheres) {
    const col = `"${w.field}"`
    if (w.operator === 'exists') {
      parts.push(`${col} ${w.value ? 'IS NOT NULL' : 'IS NULL'}`)
    } else if (w.operator === 'in') {
      paramIdx++
      parts.push(`${col} = ANY($${paramIdx})`)
    } else {
      paramIdx++
      parts.push(`${col} ${OPERATOR_SQL[w.operator]} $${paramIdx}`)
    }
  }

  if (state.searchQuery !== null) {
    const searchParamIdx = paramIdx + 1
    const lang = sanitizeLanguage(state.searchLanguage)
    parts.push(`search_vector @@ plainto_tsquery('${lang}', $${searchParamIdx})`)
  }

  return parts.length > 0 ? ` WHERE ${parts.join(' AND ')}` : ''
}

function buildOrderSql (state: QueryState): string {
  if (state.orderBys.length > 0) {
    const parts = state.orderBys.map(o => `"${o.field}" ${o.direction.toUpperCase()}`)
    return ` ORDER BY ${parts.join(', ')}`
  }
  if (state.searchQuery !== null) {
    return ' ORDER BY search_rank DESC'
  }
  return ''
}

function buildLimitOffsetSql (state: QueryState): string {
  let sql = ''
  if (state.limitVal !== null) sql += ` LIMIT ${Number(state.limitVal)}`
  if (state.offsetVal !== null) sql += ` OFFSET ${Number(state.offsetVal)}`
  return sql
}

function getWhereValues (state: QueryState): SqlValue[] {
  const values = state.wheres
    .filter(w => w.operator !== 'exists')
    .map(w => w.value)
  if (state.searchQuery !== null) {
    return [...values, state.searchQuery]
  }
  return values
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
  includeDrafts (): CollectionQueryBuilder
  search (query: string, language?: string): CollectionQueryBuilder
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
  function guard (): { error: CmsError } | { allowedFields: Set<string>, resolved: QueryState } {
    if (!isValidIdentifier(state.slug)) {
      return { error: { code: CmsErrorCode.INVALID_INPUT, message: `Invalid collection slug: ${state.slug}` } }
    }
    const result = registry.get(state.slug)
    if (result.isErr()) return { error: result.error }
    const allowedFields = getValidFieldNames(result.value)
    const fieldErr = validateFields(state, allowedFields)
    if (fieldErr) return { error: fieldErr }
    const isVersioned = result.value.versions?.drafts === true
    return { allowedFields, resolved: { ...state, isVersioned } }
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

    includeDrafts () {
      return createBuilder(pool, registry, { ...state, includeDrafts: true })
    },

    search (query, language) {
      return createBuilder(pool, registry, {
        ...state,
        searchQuery: query,
        searchLanguage: language ?? state.searchLanguage
      })
    },

    all<T> () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `${buildSelectSql(g.resolved, table)}${buildWhereSql(g.resolved)}${buildOrderSql(g.resolved)}${buildLimitOffsetSql(g.resolved)}`, getWhereValues(g.resolved))
    },

    first<T> () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `${buildSelectSql(g.resolved, table)}${buildWhereSql(g.resolved)}${buildOrderSql(g.resolved)} LIMIT 1`, getWhereValues(g.resolved))
        .map((rows: T[]) => (rows[0] as T | undefined) ?? null)
    },

    count () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      return executeQuery<Array<{ count: string }>>(pool, `SELECT COUNT(*) as count FROM ${table}${buildWhereSql(g.resolved)}`, getWhereValues(g.resolved))
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
      const whereParams = getWhereValues(g.resolved)
      const setClauses = keys.map((k, i) => `"${k}" = $${whereParams.length + i + 1}`).join(', ')
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `UPDATE ${table} SET ${setClauses}${buildWhereSql(g.resolved)} RETURNING *`, [...whereParams, ...Object.values(data)])
        .map(rows => rows[0] as T)
    },

    delete<T> () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      return executeQuery<T[]>(pool, `UPDATE ${table} SET "deleted_at" = NOW()${buildWhereSql(g.resolved)} RETURNING *`, getWhereValues(g.resolved))
        .map(rows => rows[0] as T)
    },

    page<T> (pageNum: number, perPage: number) {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      const where = buildWhereSql(g.resolved)
      const whereParams = getWhereValues(g.resolved)
      const safePerPage = Number(perPage)
      const safePageNum = Number(pageNum)

      return executeQuery<Array<{ count: string }>>(pool, `SELECT COUNT(*) as count FROM ${table}${where}`, whereParams)
        .andThen(countRows => {
          const totalDocs = Number(countRows[0]?.count ?? 0)
          const totalPages = Math.ceil(totalDocs / safePerPage)
          const pageOffset = (safePageNum - 1) * safePerPage

          return executeQuery<T[]>(pool, `${buildSelectSql(g.resolved, table)}${where}${buildOrderSql(g.resolved)} LIMIT ${safePerPage} OFFSET ${pageOffset}`, whereParams)
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
        includeDeleted: false,
        includeDrafts: false,
        isVersioned: false,
        searchQuery: null,
        searchLanguage: 'english'
      })
    }
  }
}
