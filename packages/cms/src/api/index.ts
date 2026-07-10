export { createLocalApi } from './local-api.js'
export type { LocalApi } from './local-api.js'

export { createRestRoutes } from './rest-api.js'
export type { RestRouteHandler, RestRouteEntry } from './rest-api.js'

export { sendApiJson, sendErrorJson, safeReadBody, safeJsonParse } from './http-utils.js'

export { generateOpenApiSpec } from './openapi.js'
// #337 — argument types referenced by every LocalApi method signature
export type { FindArgs, FindByIDArgs, CreateArgs, UpdateArgs, DeleteArgs, CountArgs, FindGlobalArgs, UpdateGlobalArgs, UnpublishArgs } from './local-api.js'
export type { LocalizationParam } from './rest-api.js'
export type { OpenApiSpec } from './openapi.js'
export type { OpenApiSchema, OpenApiPathItem } from './openapi.js'
export type { JsonSchemaProperty, OpenApiOperation, SchemaRef } from './openapi.js'
export type { OpenApiParameter, OpenApiRequestBody, OpenApiResponse } from './openapi.js'
