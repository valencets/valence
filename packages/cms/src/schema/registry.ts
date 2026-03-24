import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import type { CollectionConfig } from './collection.js'
import type { GlobalConfig } from './global.js'
import { CmsErrorCode } from './types.js'
import type { CmsError } from './types.js'

export interface CollectionRegistry {
  register (config: CollectionConfig): Result<CollectionConfig, CmsError>
  get (slug: string): Result<CollectionConfig, CmsError>
  getAll (): readonly CollectionConfig[]
  has (slug: string): boolean
}

export function createCollectionRegistry (): CollectionRegistry {
  const store = new Map<string, CollectionConfig>()

  return {
    register (config) {
      if (store.has(config.slug)) {
        return err({
          code: CmsErrorCode.DUPLICATE_SLUG,
          message: `Collection "${config.slug}" is already registered`
        })
      }
      store.set(config.slug, config)
      return ok(config)
    },

    get (slug) {
      const found = store.get(slug)
      if (found === undefined) {
        return err({
          code: CmsErrorCode.NOT_FOUND,
          message: `Collection "${slug}" not found`
        })
      }
      return ok(found)
    },

    getAll () {
      return [...store.values()]
    },

    has (slug) {
      return store.has(slug)
    }
  }
}

export interface GlobalRegistry {
  register (config: GlobalConfig): Result<GlobalConfig, CmsError>
  get (slug: string): Result<GlobalConfig, CmsError>
  getAll (): readonly GlobalConfig[]
  has (slug: string): boolean
}

export function createGlobalRegistry (): GlobalRegistry {
  const store = new Map<string, GlobalConfig>()

  return {
    register (config) {
      if (store.has(config.slug)) {
        return err({
          code: CmsErrorCode.DUPLICATE_SLUG,
          message: `Global "${config.slug}" is already registered`
        })
      }
      store.set(config.slug, config)
      return ok(config)
    },

    get (slug) {
      const found = store.get(slug)
      if (found === undefined) {
        return err({
          code: CmsErrorCode.NOT_FOUND,
          message: `Global "${slug}" not found`
        })
      }
      return ok(found)
    },

    getAll () {
      return [...store.values()]
    },

    has (slug) {
      return store.has(slug)
    }
  }
}
