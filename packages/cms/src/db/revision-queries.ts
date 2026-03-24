import { ResultAsync } from '@valencets/resultkit'
import type { DbPool } from '@valencets/db'
import type { CmsError } from '../schema/types.js'
import { safeQuery } from './safe-query.js'

export interface RevisionRow {
  readonly id: string
  readonly collection_slug: string
  readonly document_id: string
  readonly revision_number: number
  readonly data: Record<string, string | number | boolean | null>
  readonly created_at: string
}

export function saveRevision (
  pool: DbPool,
  collectionSlug: string,
  documentId: string,
  data: Record<string, string | number | boolean | null>
): ResultAsync<RevisionRow, CmsError> {
  return safeQuery<Array<{ max: number | null }>>(
    pool,
    'SELECT COALESCE(MAX("revision_number"), 0) AS max FROM "document_revisions" WHERE "collection_slug" = $1 AND "document_id" = $2',
    [collectionSlug, documentId]
  ).andThen((rows) => {
    const nextNumber = (rows[0]?.max ?? 0) + 1
    return safeQuery<RevisionRow[]>(
      pool,
      'INSERT INTO "document_revisions" ("collection_slug", "document_id", "revision_number", "data") VALUES ($1, $2, $3, $4) RETURNING *',
      [collectionSlug, documentId, nextNumber, JSON.stringify(data)]
    ).map(inserted => inserted[0] as RevisionRow)
  })
}

export function getRevisions (
  pool: DbPool,
  collectionSlug: string,
  documentId: string
): ResultAsync<RevisionRow[], CmsError> {
  return safeQuery<RevisionRow[]>(
    pool,
    'SELECT * FROM "document_revisions" WHERE "collection_slug" = $1 AND "document_id" = $2 ORDER BY "revision_number" DESC',
    [collectionSlug, documentId]
  )
}

export function getRevision (
  pool: DbPool,
  collectionSlug: string,
  documentId: string,
  revisionNumber: number
): ResultAsync<RevisionRow | null, CmsError> {
  return safeQuery<RevisionRow[]>(
    pool,
    'SELECT * FROM "document_revisions" WHERE "collection_slug" = $1 AND "document_id" = $2 AND "revision_number" = $3 LIMIT 1',
    [collectionSlug, documentId, revisionNumber]
  ).map(rows => rows[0] ?? null)
}
