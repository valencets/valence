import type { CmsConfig } from '@valencets/cms'
import type { StorageAdapter } from './storage-adapter.js'

export interface CloudStoragePluginOptions {
  readonly adapter: StorageAdapter
}

export interface CmsConfigWithStorage extends CmsConfig {
  readonly storageAdapter: StorageAdapter
}

export function cloudStoragePlugin (opts: CloudStoragePluginOptions): (config: CmsConfig) => CmsConfigWithStorage {
  return (config) => ({
    ...config,
    storageAdapter: opts.adapter
  })
}
