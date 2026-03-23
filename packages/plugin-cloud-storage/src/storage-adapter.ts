import type { ResultAsync } from '@valencets/resultkit'

export interface StorageError {
  readonly message: string
}

export interface CloudStorageAdapter {
  upload(key: string, buffer: Buffer, contentType?: string): ResultAsync<string, StorageError>
  delete(key: string): ResultAsync<void, StorageError>
  getUrl(key: string): string
}
