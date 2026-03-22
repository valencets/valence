import type { CmsConfig, CmsInstance } from './cms-config.js'

export interface PluginHooks {
  readonly onInit?: (cms: CmsInstance) => void | Promise<void>
  readonly onReady?: (cms: CmsInstance) => void | Promise<void>
}

export interface PluginObject {
  readonly name: string
  readonly transform: (config: CmsConfig) => CmsConfig
  readonly hooks?: PluginHooks | undefined
}

export type Plugin = ((config: CmsConfig) => CmsConfig) | PluginObject
