import { ResultAsync, errAsync } from '@valencets/resultkit'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { WhereOperator, PaginatedResult, SqlValue, WhereClause, WhereCondition } from './query-types.js'
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
  readonly whereGroups: readonly (readonly WhereEntry[])[]
  readonly orderBys: readonly { field: string, direction: 'asc' | 'desc' }[]
  readonly limitVal: number | null
  readonly offsetVal: number | null
  readonly includeDeleted: boolean
  readonly includeDrafts: boolean
  readonly isVersioned: boolean
  readonly searchQuery: string | null
  readonly searchLanguage: string
  readonly locale: string | null
  readonly defaultLocale: string | null
  readonly localizedFields: ReadonlySet<string>
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
  for (const group of state.whereGroups) {
    for (const w of group) {
      if (!isAllowedField(w.field, allowedFields)) return invalidField(w.field)
    }
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

function escapeLocale (code: string): string {
  return code.replace(/'/g, "''")
}

function buildLocaleExtracts (state: QueryState): string {
  if (state.locale === null || state.localizedFields.size === 0) return ''
  const defaultLocale = state.defaultLocale ?? state.locale
  const safeLocale = escapeLocale(state.locale)
  const safeDefault = escapeLocale(defaultLocale)
  return [...state.localizedFields].map(f =>
    `COALESCE("${f}"->>'${safeLocale}', "${f}"->>'${safeDefault}') AS "${f}"`
  ).join(', ')
}

function buildSelectSql (state: QueryState, table: string): string {
  const extras: string[] = []
  const localeExtracts = buildLocaleExtracts(state)
  if (localeExtracts.length > 0) extras.push(localeExtracts)
  if (state.searchQuery !== null) {
    const searchParamIdx = getWhereParamCount(state) + 1
    const lang = sanitizeLanguage(state.searchLanguage)
    extras.push(`ts_rank(search_vector, plainto_tsquery('${lang}', $${searchParamIdx})) AS search_rank`)
  }
  if (extras.length > 0) return `SELECT *, ${extras.join(', ')} FROM ${table}`
  return `SELECT * FROM ${table}`
}

function getWhereParamCount (state: QueryState): number {
  return state.whereGroups.flatMap(group => group).filter(w => w.operator !== 'exists').length
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

  const renderWhere = (w: WhereEntry): string => {
    const col = `"${w.field}"`
    if (w.operator === 'exists') {
      return `${col} ${w.value ? 'IS NOT NULL' : 'IS NULL'}`
    }
    if (w.operator === 'in') {
      paramIdx++
      return `${col} = ANY($${paramIdx})`
    }
    paramIdx++
    return `${col} ${OPERATOR_SQL[w.operator]} $${paramIdx}`
  }

  const populatedGroups = state.whereGroups.filter(group => group.length > 0)
  if (populatedGroups.length === 1) {
    parts.push(populatedGroups[0]!.map(renderWhere).join(' AND '))
  } else if (populatedGroups.length > 1) {
    parts.push(`(${populatedGroups.map(group => `(${group.map(renderWhere).join(' AND ')})`).join(' OR ')})`)
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
  const values = state.whereGroups
    .flatMap(group => group)
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
  whereClause (clause: WhereClause): CollectionQueryBuilder
  orderBy (field: string, direction: 'asc' | 'desc'): CollectionQueryBuilder
  limit (n: number): CollectionQueryBuilder
  offset (n: number): CollectionQueryBuilder
  withDeleted (): CollectionQueryBuilder
  includeDrafts (): CollectionQueryBuilder
  search (query: string, language?: string): CollectionQueryBuilder
  locale (code: string): CollectionQueryBuilder
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
  function ensureWhereGroups (): readonly (readonly WhereEntry[])[] {
    return state.whereGroups.length > 0 ? state.whereGroups : [[]]
  }

  function guard (): { error: CmsError } | { allowedFields: Set<string>; localizedFields: Set<string>; resolved: QueryState } {
    if (!isValidIdentifier(state.slug)) {
      return { error: { code: CmsErrorCode.INVALID_INPUT, message: `Invalid collection slug: ${state.slug}` } }
    }
    const result = registry.get(state.slug)
    if (result.isErr()) return { error: result.error }
    const collection = result.value
    const allowedFields = getValidFieldNames(collection)
    const fieldErr = validateFields(state, allowedFields)
    if (fieldErr) return { error: fieldErr }
    const isVersioned = result.value.versions?.drafts === true
    const localizedFields = new Set(collection.fields.filter(f => f.localized === true).map(f => f.name))
    return { allowedFields, localizedFields, resolved: { ...state, isVersioned } }
  }

  function whereImpl (fieldOrName: string, operatorOrValue: SqlValue | WhereOperator, maybeValue?: SqlValue): CollectionQueryBuilder {
    const hasOperator = maybeValue !== undefined
    const operator: WhereOperator = hasOperator ? operatorOrValue as WhereOperator : 'equals'
    const value: SqlValue = hasOperator ? maybeValue : operatorOrValue as SqlValue
    const existingGroups = ensureWhereGroups()
    const [firstGroup, ...restGroups] = existingGroups
    return createBuilder(pool, registry, {
      ...state,
      whereGroups: [[...(firstGroup ?? []), { field: fieldOrName, operator, value }], ...restGroups]
    })
  }

  function conditionToEntry (condition: WhereCondition): WhereEntry {
    return {
      field: condition.field,
      operator: condition.operator,
      value: condition.value
    }
  }

  return {
    where: whereImpl as CollectionQueryBuilder['where'],

    whereClause (clause) {
      let groups = [...ensureWhereGroups()].map(group => [...group])

      if (clause.and !== undefined && clause.and.length > 0) {
        const andEntries = clause.and.map(conditionToEntry)
        groups = groups.map(group => [...group, ...andEntries])
      }

      if (clause.or !== undefined && clause.or.length > 0) {
        const nextGroups: WhereEntry[][] = []
        for (const group of groups) {
          for (const condition of clause.or) {
            nextGroups.push([...group, conditionToEntry(condition)])
          }
        }
        groups = nextGroups
      }

      return createBuilder(pool, registry, {
        ...state,
        whereGroups: groups
      })
    },

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

    locale (code) {
      return createBuilder(pool, registry, {
        ...state,
        locale: code
      })
    },

    all<T> () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      const resolved = { ...g.resolved, localizedFields: g.localizedFields }
      return executeQuery<T[]>(pool, `${buildSelectSql(resolved, table)}${buildWhereSql(resolved)}${buildOrderSql(resolved)}${buildLimitOffsetSql(resolved)}`, getWhereValues(resolved))
    },

    first<T> () {
      const g = guard()
      if ('error' in g) return errAsync(g.error)
      const table = `"${state.slug}"`
      const resolved = { ...g.resolved, localizedFields: g.localizedFields }
      return executeQuery<T[]>(pool, `${buildSelectSql(resolved, table)}${buildWhereSql(resolved)}${buildOrderSql(resolved)} LIMIT 1`, getWhereValues(resolved))
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
      const resolved = { ...g.resolved, localizedFields: g.localizedFields }
      const where = buildWhereSql(resolved)
      const whereParams = getWhereValues(resolved)
      const safePerPage = Number(perPage)
      const safePageNum = Number(pageNum)

      return executeQuery<Array<{ count: string }>>(pool, `SELECT COUNT(*) as count FROM ${table}${where}`, whereParams)
        .andThen(countRows => {
          const totalDocs = Number(countRows[0]?.count ?? 0)
          const totalPages = Math.ceil(totalDocs / safePerPage)
          const pageOffset = (safePageNum - 1) * safePerPage

          return executeQuery<T[]>(pool, `${buildSelectSql(resolved, table)}${where}${buildOrderSql(resolved)} LIMIT ${safePerPage} OFFSET ${pageOffset}`, whereParams)
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

export function createQueryBuilder (pool: DbPool, registry: CollectionRegistry, defaultLocale?: string): QueryBuilderFactory {
  return {
    query (slug: string): CollectionQueryBuilder {
      return createBuilder(pool, registry, {
        slug,
        whereGroups: [[]],
        orderBys: [],
        limitVal: null,
        offsetVal: null,
        includeDeleted: false,
        includeDrafts: false,
        isVersioned: false,
        searchQuery: null,
        searchLanguage: 'english',
        locale: null,
        defaultLocale: defaultLocale ?? null,
        localizedFields: new Set<string>()
      })
    }
  }
}
