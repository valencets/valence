import type { CmsConfig } from './cms-config.js'

export type Plugin = (config: CmsConfig) => CmsConfig
