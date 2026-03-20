import type { ResultAsync } from 'neverthrow'

export interface StorageError {
  readonly message: string
}

export interface StorageAdapter {
  upload(key: string, buffer: Buffer, contentType?: string): ResultAsync<string, StorageError>
  delete(key: string): ResultAsync<void, StorageError>
  getUrl(key: string): string
}
