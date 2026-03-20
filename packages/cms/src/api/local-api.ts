import { ResultAsync, errAsync, okAsync } from 'neverthrow'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import type { GlobalRegistry } from '../schema/registry.js'
import type { CmsError } from '../schema/types.js'
import type { DocumentRow, DocumentData } from '../db/query-builder.js'
import type { PaginatedResult } from '../db/query-types.js'
import type { HookFunction, HookData } from '../hooks/hook-types.js'
import { createQueryBuilder } from '../db/query-builder.js'
import { CmsErrorCode, StatusCode } from '../schema/types.js'
import { isValidIdentifier } from '../db/sql-sanitize.js'
import { safeQuery } from '../db/safe-query.js'
import { runHooks } from '../hooks/hook-runner.js'

export interface FindArgs {
  readonly collection: string
  readonly where?: Record<string, string | number | boolean | null> | undefined
  readonly orderBy?: { field: string; direction: 'asc' | 'desc' } | undefined
  readonly page?: number | undefined
  readonly perPage?: number | undefined
  readonly search?: string | undefined
  readonly limit?: number | undefined
  readonly filters?: Record<string, string> | undefined
  readonly includeDrafts?: boolean | undefined
}

interface FindByIDArgs {
  readonly collection: string
  readonly id: string
}

interface CreateArgs {
  readonly collection: string
  readonly data: DocumentData
  readonly draft?: boolean | undefined
}

interface UpdateArgs {
  readonly collection: string
  readonly id: string
  readonly data: DocumentData
  readonly publish?: boolean | undefined
  readonly draft?: boolean | undefined
}

interface DeleteArgs {
  readonly collection: string
  readonly id: string
}

interface CountArgs {
  readonly collection: string
  readonly where?: Record<string, string | number | boolean | null> | undefined
}

interface FindGlobalArgs {
  readonly slug: string
}

interface UpdateGlobalArgs {
  readonly slug: string
  readonly data: DocumentData
}

interface UnpublishArgs {
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
    return runHooks(hooks, { data: result as unknown as HookData, id, collection: collectionSlug })
      .map(() => result)
  }
  return okAsync(result)
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
    ? runHooks(beforeHooks, { data: data as HookData, id, collection: collectionSlug })
      .andThen((hookData) => execute(hookData as DocumentData))
    : execute(data)

  return beforeResult.andThen((result) => runAfterHooks(afterHooks, result, id, collectionSlug))
}

export function createLocalApi (
  pool: DbPool,
  collections: CollectionRegistry,
  globals: GlobalRegistry
): LocalApi {
  const qb = createQueryBuilder(pool, collections)

  return {
    find (args) {
      let builder = qb.query(args.collection)
      if (args.includeDrafts) builder = builder.includeDrafts()
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
      if (args.page !== undefined && args.perPage !== undefined) {
        return builder.page(args.page, args.perPage)
      }
      if (args.limit) builder = builder.limit(args.limit)
      return builder.all()
    },

    findByID (args) {
      return qb.query(args.collection)
        .where('id', args.id)
        .first()
    },

    create (args) {
      const col = collections.get(args.collection)
      if (col.isErr()) return errAsync(col.error)
      const isVersioned = col.value.versions?.drafts === true

      const data = isVersioned && args.draft
        ? { ...args.data, _status: StatusCode.DRAFT }
        : isVersioned
          ? { ...args.data, _status: StatusCode.PUBLISHED }
          : args.data

      return qb.query(args.collection).insert(data)
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

      if (isVersioned && args.publish && col.value.hooks) {
        return executeWithHooks(
          col.value.hooks.beforePublish,
          col.value.hooks.afterPublish,
          data,
          args.id,
          args.collection,
          (finalData) => qb.query(args.collection).where('id', args.id).update(finalData)
        )
      }

      return qb.query(args.collection)
        .where('id', args.id)
        .update(data)
    },

    delete (args) {
      return qb.query(args.collection)
        .where('id', args.id)
        .delete()
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
      return safeQuery<DocumentRow[]>(pool, `UPDATE ${table} SET ${setClauses} WHERE "deleted_at" IS NULL RETURNING *`, params)
        .map(rows => rows[0] as DocumentRow)
    },

    unpublish (args) {
      const col = collections.get(args.collection)
      if (col.isErr()) return errAsync(col.error)

      const unpublishData: DocumentData = { _status: StatusCode.DRAFT }

      if (col.value.hooks) {
        return executeWithHooks(
          col.value.hooks.beforeUnpublish,
          col.value.hooks.afterUnpublish,
          unpublishData,
          args.id,
          args.collection,
          (finalData) => qb.query(args.collection).where('id', args.id).includeDrafts().update(finalData)
        )
      }

      return qb.query(args.collection)
        .where('id', args.id)
        .includeDrafts()
        .update(unpublishData)
    }
  }
}
