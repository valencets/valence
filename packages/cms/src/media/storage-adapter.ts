import { ResultAsync, errAsync } from '@valencets/resultkit'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import { writeFile, readFile, unlink } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'

export interface StorageAdapter {
  readonly write: (filename: string, data: Buffer) => ResultAsync<string, CmsError>
  readonly read: (filename: string) => ResultAsync<Buffer, CmsError>
  readonly remove: (filename: string) => ResultAsync<void, CmsError>
  readonly url: (filename: string) => string
}

export function createLocalStorage (uploadDir: string): StorageAdapter {
  const resolvedDir = resolve(uploadDir)

  return {
    write (filename: string, data: Buffer): ResultAsync<string, CmsError> {
      const safeName = basename(filename)
      const filePath = resolve(join(resolvedDir, safeName))
      if (!filePath.startsWith(resolvedDir)) {
        return errAsync({ code: CmsErrorCode.FORBIDDEN, message: 'Path traversal rejected' })
      }
      return ResultAsync.fromPromise(
        writeFile(filePath, data).then(() => safeName),
        (e): CmsError => ({
          code: CmsErrorCode.INTERNAL,
          message: e instanceof Error ? e.message : 'File write failed'
        })
      )
    },

    read (filename: string): ResultAsync<Buffer, CmsError> {
      const safeName = basename(filename)
      const filePath = resolve(join(resolvedDir, safeName))
      if (!filePath.startsWith(resolvedDir)) {
        return errAsync({ code: CmsErrorCode.FORBIDDEN, message: 'Path traversal rejected' })
      }
      return ResultAsync.fromPromise(
        readFile(filePath),
        (e): CmsError => ({
          code: CmsErrorCode.NOT_FOUND,
          message: e instanceof Error ? e.message : 'File read failed'
        })
      )
    },

    remove (filename: string): ResultAsync<void, CmsError> {
      const safeName = basename(filename)
      const filePath = resolve(join(resolvedDir, safeName))
      if (!filePath.startsWith(resolvedDir)) {
        return errAsync({ code: CmsErrorCode.FORBIDDEN, message: 'Path traversal rejected' })
      }
      return ResultAsync.fromPromise(
        unlink(filePath),
        (e): CmsError => ({
          code: CmsErrorCode.NOT_FOUND,
          message: e instanceof Error ? e.message : 'File delete failed'
        })
      )
    },

    url (filename: string): string {
      return `/media/${encodeURIComponent(basename(filename))}`
    }
  }
}
