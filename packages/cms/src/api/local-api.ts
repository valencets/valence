import { ResultAsync, errAsync } from 'neverthrow'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import type { GlobalRegistry } from '../schema/registry.js'
import type { CmsError } from '../schema/types.js'
import type { DocumentRow, DocumentData } from '../db/query-builder.js'
import { createQueryBuilder } from '../db/query-builder.js'
import { CmsErrorCode } from '../schema/types.js'
import type { SqlValue } from '../db/query-types.js'
import { isValidIdentifier } from '../db/sql-sanitize.js'

function executeGlobalQuery<T> (pool: DbPool, sql: string, params: SqlValue[] = []): ResultAsync<T, CmsError> {
  return ResultAsync.fromPromise(
    pool.sql(sql as never, ...params as never[]).then((rows) => [...rows] as T),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INTERNAL,
      message: e instanceof Error ? e.message : 'Global query failed'
    })
  )
}

interface FindArgs {
  readonly collection: string
  readonly where?: Record<string, string | number | boolean | null> | undefined
  readonly sort?: string | undefined
  readonly limit?: number | undefined
  readonly page?: number | undefined
}

interface FindByIDArgs {
  readonly collection: string
  readonly id: string
}

interface CreateArgs {
  readonly collection: string
  readonly data: DocumentData
}

interface UpdateArgs {
  readonly collection: string
  readonly id: string
  readonly data: DocumentData
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

export interface LocalApi {
  find (args: FindArgs): ResultAsync<DocumentRow[], CmsError>
  findByID (args: FindByIDArgs): ResultAsync<DocumentRow | null, CmsError>
  create (args: CreateArgs): ResultAsync<DocumentRow, CmsError>
  update (args: UpdateArgs): ResultAsync<DocumentRow, CmsError>
  delete (args: DeleteArgs): ResultAsync<DocumentRow, CmsError>
  count (args: CountArgs): ResultAsync<number, CmsError>
  findGlobal (args: FindGlobalArgs): ResultAsync<DocumentRow | null, CmsError>
  updateGlobal (args: UpdateGlobalArgs): ResultAsync<DocumentRow, CmsError>
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
      if (args.where) {
        for (const [k, v] of Object.entries(args.where)) {
          builder = builder.where(k, v)
        }
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
      return qb.query(args.collection)
        .insert(args.data)
    },

    update (args) {
      return qb.query(args.collection)
        .where('id', args.id)
        .update(args.data)
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
      return executeGlobalQuery<DocumentRow[]>(pool, `SELECT * FROM ${table} WHERE "deleted_at" IS NULL LIMIT 1`)
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
      return executeGlobalQuery<DocumentRow[]>(pool, `UPDATE ${table} SET ${setClauses} RETURNING *`, params)
        .map(rows => rows[0] as DocumentRow)
    }
  }
}
