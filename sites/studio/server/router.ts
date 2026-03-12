// Re-export framework server utilities from @inertia/core
// Studio-specific types (RouteContext, ServerConfig) remain in ./types.ts
export { createServerRouter, sendHtml, sendJson, sendError, isFragmentRequest, readBody } from '@inertia/core/server'
export type { ServerRouter } from '@inertia/core/server'
