import type { CmsConfig } from '@valencets/cms'
import type { CloudStorageAdapter } from './storage-adapter.js'

export interface CloudStoragePluginOptions {
  readonly adapter: CloudStorageAdapter
}

export interface CmsConfigWithStorage extends CmsConfig {
  readonly storageAdapter: CloudStorageAdapter
}

export function cloudStoragePlugin (opts: CloudStoragePluginOptions): (config: CmsConfig) => CmsConfigWithStorage {
  return (config) => ({
    ...config,
    storageAdapter: opts.adapter
  })
}
