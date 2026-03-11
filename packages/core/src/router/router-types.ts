export const RouterErrorCode = {
  FETCH_FAILED: 'FETCH_FAILED',
  PARSE_FAILED: 'PARSE_FAILED',
  SELECTOR_MISS: 'SELECTOR_MISS',
  INVALID_URL: 'INVALID_URL',
  CACHE_MISS: 'CACHE_MISS',
  PREFETCH_FAILED: 'PREFETCH_FAILED',
  NOT_HTML_RESPONSE: 'NOT_HTML_RESPONSE'
} as const

export type RouterErrorCode = typeof RouterErrorCode[keyof typeof RouterErrorCode]

export interface RouterError {
  readonly code: RouterErrorCode
  readonly message: string
}

export interface RouterConfig {
  readonly contentSelector?: string
  readonly prefetchCacheCapacity?: number
  readonly prefetchTtlMs?: number
  readonly velocityThreshold?: number
  readonly intentDurationMs?: number
}

export interface ResolvedRouterConfig {
  readonly contentSelector: string
  readonly prefetchCacheCapacity: number
  readonly prefetchTtlMs: number
  readonly velocityThreshold: number
  readonly intentDurationMs: number
}

export interface CachedResponse {
  readonly url: string
  readonly html: string
  readonly timestamp: number
}

export interface NavigationDetail {
  readonly fromUrl: string
  readonly toUrl: string
}

const DEFAULT_CONFIG: ResolvedRouterConfig = {
  contentSelector: 'main',
  prefetchCacheCapacity: 32,
  prefetchTtlMs: 30_000,
  velocityThreshold: 0.3,
  intentDurationMs: 80
}

export function resolveConfig (partial?: RouterConfig): ResolvedRouterConfig {
  if (partial === undefined) return DEFAULT_CONFIG
  return {
    contentSelector: partial.contentSelector ?? DEFAULT_CONFIG.contentSelector,
    prefetchCacheCapacity: partial.prefetchCacheCapacity ?? DEFAULT_CONFIG.prefetchCacheCapacity,
    prefetchTtlMs: partial.prefetchTtlMs ?? DEFAULT_CONFIG.prefetchTtlMs,
    velocityThreshold: partial.velocityThreshold ?? DEFAULT_CONFIG.velocityThreshold,
    intentDurationMs: partial.intentDurationMs ?? DEFAULT_CONFIG.intentDurationMs
  }
}
