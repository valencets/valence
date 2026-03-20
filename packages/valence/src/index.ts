export { defineConfig } from './define-config.js'
export type { ValenceConfig, ResolvedValenceConfig, ConfigError, OnServerContext } from './define-config.js'

// Re-export CMS schema primitives for convenience
export { collection, field, global } from '@valencets/cms'
