// Barrel export — named exports only, no default exports
export { RouterErrorCode, resolveConfig } from './router-types.js'
export type {
  RouterError,
  RouterConfig,
  ResolvedRouterConfig,
  CachedResponse,
  NavigationDetail,
  PageCacheEntry,
  NavigationPerformance
} from './router-types.js'
export { parseHtml, extractFragment, extractTitle, swapContent, supportsMoveBefore } from './fragment-swap.js'
export { calculateVelocity, initPrefetch } from './prefetch.js'
export type { PrefetchHandle } from './prefetch.js'
export { initPageCache } from './page-cache.js'
export type { PageCacheHandle } from './page-cache.js'
export { shouldIntercept, initRouter } from './push-state.js'
export type { RouterHandle } from './push-state.js'
export { supportsViewTransitions, applyTransitionNames, clearTransitionNames, wrapInTransition } from './view-transitions.js'
