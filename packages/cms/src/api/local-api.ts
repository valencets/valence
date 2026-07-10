import { ResultAsync, errAsync, okAsync } from '@valencets/resultkit'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry, GlobalRegistry } from '../schema/registry.js'
import type { CmsError } from '../schema/types.js'
import type { DocumentRow, DocumentData } from '../db/query-builder.js'
import type { PaginatedResult, SqlValue, WhereClause } from '../db/query-types.js'
import type { HookFunction } from '../hooks/hook-types.js'
import type { FieldConfig } from '../schema/field-types.js'
import type { AccessArgs } from '../access/access-types.js'
import { createQueryBuilder } from '../db/query-builder.js'
import { CmsErrorCode, StatusCode } from '../schema/types.js'
import { isValidIdentifier } from '../db/sql-sanitize.js'
import { safeQuery } from '../db/safe-query.js'
import { runHooks } from '../hooks/hook-runner.js'
import { runFieldHooks } from '../hooks/field-hook-runner.js'

export interface FindArgs {
  readonly collection: string
  readonly where?: Record<string, string | number | boolean | null> | undefined
  readonly whereClause?: WhereClause | undefined
  readonly orderBy?: { field: string; direction: 'asc' | 'desc' } | undefined
  readonly page?: number | undefined
  readonly perPage?: number | undefined
  readonly search?: string | undefined
  readonly limit?: number | undefined
  readonly filters?: Record<string, string> | undefined
  readonly includeDrafts?: boolean | undefined
  readonly locale?: string | undefined
}

export interface FindByIDArgs {
  readonly collection: string
  readonly id: string
  readonly whereClause?: WhereClause | undefined
}

export interface CreateArgs {
  readonly collection: string
  readonly data: DocumentData
  readonly draft?: boolean | undefined
  readonly locale?: string | undefined
}

export interface UpdateArgs {
  readonly collection: string
  readonly id: string
  readonly data: DocumentData
  readonly publish?: boolean | undefined
  readonly draft?: boolean | undefined
  readonly locale?: string | undefined
}

export interface DeleteArgs {
  readonly collection: string
  readonly id: string
}

export interface CountArgs {
  readonly collection: string
  readonly where?: Record<string, string | number | boolean | null> | undefined
}

export interface FindGlobalArgs {
  readonly slug: string
}

export interface UpdateGlobalArgs {
  readonly slug: string
  readonly data: DocumentData
}

export interface UnpublishArgs {
  readonly collection: string
  readonly id: string
}

export interface LocalApi {
  find (args: FindArgs): ResultAsync<DocumentRow[] | PaginatedResult<DocumentRow>, CmsError>
  findByID (args: FindByIDArgs): ResultAsync<DocumentRow | null, CmsError>
  create (args: CreateArgs): ResultAsync<DocumentRow, CmsError>
  update (args: UpdateArgs): ResultAsync<DocumentRow, CmsError>
  delete (args: DeleteArgs): ResultAsync<DocumentRow, CmsError>
  count (args: CountArgs): ResultAsync<number, CmsError>
  findGlobal (args: FindGlobalArgs): ResultAsync<DocumentRow | null, CmsError>
  updateGlobal (args: UpdateGlobalArgs): ResultAsync<DocumentRow, CmsError>
  unpublish (args: UnpublishArgs): ResultAsync<DocumentRow, CmsError>
}

function runAfterHooks (
  hooks: readonly HookFunction[] | undefined,
  result: DocumentRow,
  id: string,
  collectionSlug: string
): ResultAsync<DocumentRow, CmsError> {
  if (hooks && hooks.length > 0) {
    return runHooks(hooks, { data: result, id, collection: collectionSlug })
      .map(() => result)
  }
  return okAsync(result)
}

/** Run a collection hook list as a data transform; empty lists pass data through. */
function runCollectionHookList (
  hooks: readonly HookFunction[] | undefined,
  data: DocumentData,
  id: string | undefined,
  collectionSlug: string
): ResultAsync<DocumentData, CmsError> {
  if (!hooks || hooks.length === 0) return okAsync(data)
  return runHooks(hooks, { data, id, collection: collectionSlug })
    .map((hookData) => hookData as DocumentData)
}

/** Collection afterRead runs once per returned document and may transform it. */
function applyCollectionAfterRead (
  hooks: readonly HookFunction[] | undefined,
  rows: readonly DocumentRow[],
  collectionSlug: string
): ResultAsync<DocumentRow[], CmsError> {
  if (!hooks || hooks.length === 0) return okAsync([...rows])

  let result = okAsync<DocumentRow[], CmsError>([])
  for (const row of rows) {
    result = result.andThen((acc) =>
      runHooks(hooks, { data: row, id: row.id as string | undefined, collection: collectionSlug })
        .map((transformed) => [...acc, transformed as DocumentRow])
    )
  }
  return result
}

function executeWithHooks (
  beforeHooks: readonly HookFunction[] | undefined,
  afterHooks: readonly HookFunction[] | undefined,
  data: DocumentData,
  id: string,
  collectionSlug: string,
  execute: (finalData: DocumentData) => ResultAsync<DocumentRow, CmsError>
): ResultAsync<DocumentRow, CmsError> {
  const beforeResult = (beforeHooks && beforeHooks.length > 0)
    ? runHooks(beforeHooks, { data, id, collection: collectionSlug })
      .andThen((hookData) => execute(hookData as DocumentData))
    : execute(data)

  return beforeResult.andThen((result) => runAfterHooks(afterHooks, result, id, collectionSlug))
}

function applyFieldAfterRead (
  fields: readonly FieldConfig[],
  rows: readonly DocumentRow[],
  collection: string
): ResultAsync<DocumentRow[], CmsError> {
  const hasAfterRead = fields.some(f => f.hooks?.afterRead && f.hooks.afterRead.length > 0)
  if (!hasAfterRead) return okAsync([...rows])

  let result = okAsync<DocumentRow[], CmsError>([])
  for (const row of rows) {
    result = result.andThen((acc) =>
      runFieldHooks('afterRead', fields, row, row.id as string | undefined, collection)
        .map((transformed) => [...acc, transformed as DocumentRow])
    )
  }
  return result
}

function wrapLocalizedFields (
  data: DocumentData,
  fields: readonly FieldConfig[],
  locale: string
): DocumentData {
  const localizedNames = new Set(fields.filter(f => f.localized).map(f => f.name))
  const wrapped: Record<string, SqlValue> = {}
  for (const [key, value] of Object.entries(data)) {
    if (localizedNames.has(key) && value !== null && value !== undefined) {
      wrapped[key] = JSON.stringify({ [locale]: value }) as SqlValue
    } else {
      wrapped[key] = value
    }
  }
  return wrapped
}

function filterReadAccess (
  doc: DocumentRow,
  fields: readonly FieldConfig[],
  context: AccessArgs
): DocumentRow {
  const filtered: Record<string, SqlValue | undefined> = { ...doc }
  for (const f of fields) {
    if (f.access?.read) {
      const allowed = f.access.read(context)
      if (allowed === false) {
        delete filtered[f.name]
      }
    }
  }
  return filtered as DocumentRow
}

function filterWriteAccess (
  data: DocumentData,
  fields: readonly FieldConfig[],
  context: AccessArgs,
  operation: 'create' | 'update'
): DocumentData {
  const filtered: Record<string, SqlValue> = {}
  for (const [key, value] of Object.entries(data)) {
    const fieldConfig = fields.find(f => f.name === key)
    const accessFn = operation === 'create' ? fieldConfig?.access?.create : fieldConfig?.access?.update
    if (accessFn && !accessFn(context)) continue
    filtered[key] = value
  }
  return filtered
}

function mergeLocalizedUpdate (
  pool: DbPool,
  slug: string,
  id: string,
  data: DocumentData,
  localizedNames: ReadonlySet<string>,
  locale: string
): ResultAsync<DocumentRow, CmsError> {
  if (!isValidIdentifier(slug)) {
    return errAsync({ code: CmsErrorCode.INVALID_INPUT, message: `Invalid collection slug: ${slug}` })
  }
  if (!isValidIdentifier(locale)) {
    return errAsync({ code: CmsErrorCode.INVALID_INPUT, message: `Invalid locale: ${locale}` })
  }
  const setClauses: string[] = []
  const params: SqlValue[] = []
  let paramIdx = 0

  for (const [key, value] of Object.entries(data)) {
    if (!isValidIdentifier(key)) {
      return errAsync({ code: CmsErrorCode.INVALID_INPUT, message: `Invalid field name: ${key}` })
    }
    paramIdx++
    if (localizedNames.has(key)) {
      setClauses.push(`"${key}" = COALESCE("${key}", '{}'::jsonb) || jsonb_build_object('${locale}', $${paramIdx}::text)::jsonb`)
      params.push(value)
    } else {
      setClauses.push(`"${key}" = $${paramIdx}`)
      params.push(value)
    }
  }

  paramIdx++
  params.push(id)
  const sql = `UPDATE "${slug}" SET ${setClauses.join(', ')} WHERE "id" = $${paramIdx} AND "deleted_at" IS NULL RETURNING *`
  return safeQuery<DocumentRow[]>(pool, sql, params)
    .map(rows => rows[0] as DocumentRow)
}

/**
 * Wrap a transaction sql handle as a DbPool for use with query builder and safeQuery.
 * TransactionSql has the same query interface (unsafe, tagged template) as Sql.
 */
function txAsPool (tx: { unsafe: DbPool['sql']['unsafe'] }): DbPool {
  return { sql: tx as DbPool['sql'] }
}

/** Typed error wrapper for CmsError — avoids banned `as CmsError` cast in mapTxError. */
class CmsTxError extends Error {
  readonly cmsError: CmsError
  constructor (cmsError: CmsError) {
    super(cmsError.message)
    this.cmsError = cmsError
  }
}

/** Unwrap a ResultAsync inside a transaction — throws on Err to trigger rollback. */
async function unwrapTx<T> (result: ResultAsync<T, CmsError>): Promise<T> {
  return result.match(
    (d) => d,
    // eslint-disable-next-line no-restricted-syntax -- intentional throw to trigger transaction rollback
    (e) => { throw new CmsTxError(e) }
  )
}

/** Map a thrown error back to CmsError, preserving cmsError if set by unwrapTx. */
function mapTxError (e: unknown): CmsError {
  if (e instanceof CmsTxError) return e.cmsError
  return { code: CmsErrorCode.INTERNAL, message: e instanceof Error ? e.message : 'Transaction failed' }
}

export function createLocalApi (
  pool: DbPool,
  collections: CollectionRegistry,
  globals: GlobalRegistry,
  defaultLocale?: string
): LocalApi {
  const qb = createQueryBuilder(pool, collections, defaultLocale)

  function applyReadFilter (doc: DocumentRow, collectionSlug: string): DocumentRow {
    const col = collections.get(collectionSlug)
    if (col.isErr()) return doc
    const context: AccessArgs = { id: doc.id }
    return filterReadAccess(doc, col.value.fields, context)
  }

  function applyWriteFilter (
    data: DocumentData,
    collectionSlug: string,
    operation: 'create' | 'update'
  ): DocumentData {
    const col = collections.get(collectionSlug)
    if (col.isErr()) return data
    const context: AccessArgs = {}
    return filterWriteAccess(data, col.value.fields, context, operation)
  }

  return {
    find (args) {
      const col = collections.get(args.collection)
      if (col.isErr()) return errAsync(col.error)

      const beforeReadHooks = col.value.hooks?.beforeRead
      const executeFind = (): ResultAsync<DocumentRow[] | PaginatedResult<DocumentRow>, CmsError> => {
        let builder = qb.query(args.collection)
        if (args.includeDrafts) builder = builder.includeDrafts()
        if (args.locale) builder = builder.locale(args.locale)
        if (args.whereClause) builder = builder.whereClause(args.whereClause)
        if (args.where) {
          for (const [k, v] of Object.entries(args.where)) {
            builder = builder.where(k, v)
          }
        }
        if (args.filters) {
          for (const [k, v] of Object.entries(args.filters)) {
            if (v === '') continue
            const coerced = v === 'true' ? true : v === 'false' ? false : v
            builder = builder.where(k, coerced)
          }
        }
        if (args.search) builder = builder.search(args.search)
        if (args.orderBy) builder = builder.orderBy(args.orderBy.field, args.orderBy.direction)
        // Read order (#335): afterRead(field) → afterRead(col), once per
        // document, before field-level access filtering.
        if (args.page !== undefined && args.perPage !== undefined) {
          return builder.page(args.page, args.perPage).andThen((paginated) =>
            applyFieldAfterRead(col.value.fields, paginated.docs, args.collection)
              .andThen((docs) => applyCollectionAfterRead(col.value.hooks?.afterRead, docs, args.collection))
              .map((docs) => ({
                ...paginated,
                docs: docs.map((d) => applyReadFilter(d, args.collection))
              }))
          )
        }
        if (args.limit) builder = builder.limit(args.limit)
        return builder.all().andThen((rows) =>
          applyFieldAfterRead(col.value.fields, rows, args.collection)
            .andThen((docs) => applyCollectionAfterRead(col.value.hooks?.afterRead, docs, args.collection))
            .map((docs) => docs.map((r) => applyReadFilter(r, args.collection)))
        )
      }

      if (beforeReadHooks && beforeReadHooks.length > 0) {
        return runHooks(beforeReadHooks, { data: {}, collection: args.collection })
          .andThen(() => executeFind())
      }
      return executeFind()
    },

    // findByID intentionally bypasses status filter — admin lookups need access to drafts
    findByID (args) {
      const col = collections.get(args.collection)
      if (col.isErr()) return errAsync(col.error)

      const beforeReadHooks = col.value.hooks?.beforeRead
      const executeFindByID = (): ResultAsync<DocumentRow | null, CmsError> =>
        qb.query(args.collection)
          .where('id', args.id)
          .whereClause(args.whereClause ?? {})
          .first()
          .andThen((row) => {
            if (row === null) return okAsync(null)
            return applyFieldAfterRead(col.value.fields, [row], args.collection)
              .andThen((rows) => applyCollectionAfterRead(col.value.hooks?.afterRead, rows, args.collection))
              .map((rows) => {
                const doc = rows[0] ?? null
                return doc ? applyReadFilter(doc, args.collection) : null
              })
          })

      if (beforeReadHooks && beforeReadHooks.length > 0) {
        return runHooks(beforeReadHooks, { data: {}, id: args.id, collection: args.collection })
          .andThen(() => executeFindByID())
      }
      return executeFindByID()
    },

    create (args) {
      const col = collections.get(args.collection)
      if (col.isErr()) return errAsync(col.error)
      const isVersioned = col.value.versions?.drafts === true

      let data = isVersioned && args.draft
        ? { ...args.data, _status: StatusCode.DRAFT }
        : isVersioned
          ? { ...args.data, _status: StatusCode.PUBLISHED }
          : args.data

      if (args.locale) {
        data = wrapLocalizedFields(data, col.value.fields, args.locale)
      }

      const fields = col.value.fields
      const colHooks = col.value.hooks

      // Canonical write order (#335): beforeValidate(col) → beforeValidate(field)
      // → beforeChange(col) → beforeChange(field) → INSERT → afterChange(field)
      // → afterChange(col). Change hooks run inside the transaction; a throwing
      // hook rolls the write back. afterChange(col) is side-effect-only — the
      // written row is authoritative.
      const executeCreate = (createData: DocumentData): ResultAsync<DocumentRow, CmsError> =>
        ResultAsync.fromPromise(
          pool.sql.begin(async (tx) => {
            const txPool = txAsPool(tx)
            const txQb = createQueryBuilder(txPool, collections, defaultLocale)

            const colChanged = await unwrapTx(
              runCollectionHookList(colHooks?.beforeChange, createData, undefined, args.collection)
            )
            const fieldData = await unwrapTx(
              runFieldHooks('beforeChange', fields, colChanged, undefined, args.collection)
            )
            const filteredData = applyWriteFilter(fieldData as DocumentData, args.collection, 'create')
            const result = await unwrapTx(txQb.query(args.collection).insert(filteredData))
            const afterResult = await unwrapTx(
              runFieldHooks('afterChange', fields, result, result.id as string | undefined, args.collection)
            )
            await unwrapTx(
              runCollectionHookList(colHooks?.afterChange, afterResult as DocumentData, result.id as string | undefined, args.collection)
            )
            return applyReadFilter(afterResult as DocumentRow, args.collection)
          }),
          mapTxError
        )

      return runCollectionHookList(colHooks?.beforeValidate, data, undefined, args.collection)
        .andThen((hookData) => runFieldHooks('beforeValidate', fields, hookData, undefined, args.collection))
        .andThen((hookData) => executeCreate(hookData as DocumentData))
    },

    update (args) {
      const col = collections.get(args.collection)
      if (col.isErr()) return errAsync(col.error)
      const isVersioned = col.value.versions?.drafts === true

      let data = args.data
      if (isVersioned && args.publish) {
        data = { ...data, _status: StatusCode.PUBLISHED }
      } else if (isVersioned && args.draft) {
        data = { ...data, _status: StatusCode.DRAFT }
      }

      data = applyWriteFilter(data, args.collection, 'update')

      const localizedNames = new Set(col.value.fields.filter(f => f.localized).map(f => f.name))
      if (args.locale && localizedNames.size > 0) {
        return ResultAsync.fromPromise(
          pool.sql.begin(async (tx) => {
            const txPool = txAsPool(tx)
            const result = await unwrapTx(
              mergeLocalizedUpdate(txPool, col.value.slug, args.id, data, localizedNames, args.locale as string)
            )
            return applyReadFilter(result, args.collection)
          }),
          mapTxError
        )
      }

      const fields = col.value.fields
      const colHooks = col.value.hooks

      // Same canonical order as create; publish updates nest the write in
      // beforePublish → UPDATE → afterPublish before the afterChange hooks.
      const executeUpdate = (updateData: DocumentData): ResultAsync<DocumentRow, CmsError> =>
        ResultAsync.fromPromise(
          pool.sql.begin(async (tx) => {
            const txPool = txAsPool(tx)
            const txQb = createQueryBuilder(txPool, collections, defaultLocale)

            const colChanged = await unwrapTx(
              runCollectionHookList(colHooks?.beforeChange, updateData, args.id, args.collection)
            )
            const fieldData = await unwrapTx(
              runFieldHooks('beforeChange', fields, colChanged, args.id, args.collection)
            )

            const written = (isVersioned && args.publish && colHooks)
              ? await unwrapTx(
                executeWithHooks(
                  colHooks.beforePublish,
                  colHooks.afterPublish,
                  fieldData as DocumentData,
                  args.id,
                  args.collection,
                  (finalData) => txQb.query(args.collection).where('id', args.id).update(finalData)
                )
              )
              : await unwrapTx(
                txQb.query(args.collection).where('id', args.id).update(fieldData as DocumentData)
              )

            const afterResult = await unwrapTx(
              runFieldHooks('afterChange', fields, written, args.id, args.collection)
            )
            await unwrapTx(
              runCollectionHookList(colHooks?.afterChange, afterResult as DocumentData, args.id, args.collection)
            )
            return applyReadFilter(afterResult as DocumentRow, args.collection)
          }),
          mapTxError
        )

      return runCollectionHookList(colHooks?.beforeValidate, data, args.id, args.collection)
        .andThen((hookData) => runFieldHooks('beforeValidate', fields, hookData, args.id, args.collection))
        .andThen((hookData) => executeUpdate(hookData as DocumentData))
    },

    delete (args) {
      const col = collections.get(args.collection)
      if (col.isErr()) return errAsync(col.error)

      const beforeDeleteHooks = col.value.hooks?.beforeDelete
      const afterDeleteHooks = col.value.hooks?.afterDelete

      const executeDelete = (): ResultAsync<DocumentRow, CmsError> =>
        ResultAsync.fromPromise(
          pool.sql.begin(async (tx) => {
            const txPool = txAsPool(tx)
            const txQb = createQueryBuilder(txPool, collections, defaultLocale)

            const result = await unwrapTx(
              txQb.query(args.collection).where('id', args.id).delete()
            )
            return unwrapTx(runAfterHooks(afterDeleteHooks, result, args.id, args.collection))
          }),
          mapTxError
        )

      if (beforeDeleteHooks && beforeDeleteHooks.length > 0) {
        return runHooks(beforeDeleteHooks, { data: {}, id: args.id, collection: args.collection })
          .andThen(() => executeDelete())
      }
      return executeDelete()
    },

    count (args) {
      let builder = qb.query(args.collection)
      if (args.where) {
        for (const [k, v] of Object.entries(args.where)) {
          builder = builder.where(k, v)
        }
      }
      return builder.count()
    },

    findGlobal (args) {
      const check = globals.get(args.slug)
      if (check.isErr()) return errAsync(check.error)
      if (!isValidIdentifier(args.slug)) {
        return errAsync({ code: CmsErrorCode.INVALID_INPUT, message: `Invalid global slug: ${args.slug}` })
      }
      const table = `"global_${args.slug}"`
      return safeQuery<DocumentRow[]>(pool, `SELECT * FROM ${table} WHERE "deleted_at" IS NULL LIMIT 1`, [])
        .map(rows => rows[0] ?? null)
    },

    updateGlobal (args) {
      const check = globals.get(args.slug)
      if (check.isErr()) return errAsync(check.error)
      if (!isValidIdentifier(args.slug)) {
        return errAsync({ code: CmsErrorCode.INVALID_INPUT, message: `Invalid global slug: ${args.slug}` })
      }
      const globalConfig = check.value
      const allowedNames = new Set(globalConfig.fields.map(f => f.name))
      const keys = Object.keys(args.data)
      for (const k of keys) {
        if (!allowedNames.has(k) || !isValidIdentifier(k)) {
          return errAsync({ code: CmsErrorCode.INVALID_INPUT, message: `Invalid field: ${k}` })
        }
      }
      const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`).join(', ')
      const params = Object.values(args.data)
      const table = `"global_${args.slug}"`
      return ResultAsync.fromPromise(
        pool.sql.begin(async (tx) => {
          const txPool = txAsPool(tx)
          const rows = await unwrapTx(
            safeQuery<DocumentRow[]>(txPool, `UPDATE ${table} SET ${setClauses} WHERE "deleted_at" IS NULL RETURNING *`, params)
          )
          return rows[0] as DocumentRow
        }),
        mapTxError
      )
    },

    unpublish (args) {
      const col = collections.get(args.collection)
      if (col.isErr()) return errAsync(col.error)

      const unpublishData: DocumentData = { _status: StatusCode.DRAFT }

      return ResultAsync.fromPromise(
        pool.sql.begin(async (tx) => {
          const txPool = txAsPool(tx)
          const txQb = createQueryBuilder(txPool, collections, defaultLocale)

          if (col.value.hooks) {
            return unwrapTx(executeWithHooks(
              col.value.hooks.beforeUnpublish,
              col.value.hooks.afterUnpublish,
              unpublishData,
              args.id,
              args.collection,
              (finalData) => txQb.query(args.collection).where('id', args.id).includeDrafts().update(finalData)
            ))
          }

          return unwrapTx(
            txQb.query(args.collection)
              .where('id', args.id)
              .includeDrafts()
              .update(unpublishData)
          )
        }),
        mapTxError
      )
    }
  }
}
