// @valencets/cms — Schema engine, admin routes, auth, and media upload for Valence sites

export {
  CmsErrorCode,
  StatusCode,
  FieldType,
  field,
  collection,
  global,
  createCollectionRegistry,
  createGlobalRegistry
} from './schema/index.js'

export type {
  CmsError,
  FieldBaseConfig,
  FieldConfig,
  TextFieldConfig,
  TextareaFieldConfig,
  RichtextFieldConfig,
  NumberFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  SelectOption,
  DateFieldConfig,
  SlugFieldConfig,
  MediaFieldConfig,
  RelationFieldConfig,
  GroupFieldConfig,
  EmailFieldConfig,
  UrlFieldConfig,
  PasswordFieldConfig,
  JsonFieldConfig,
  ColorFieldConfig,
  MultiselectFieldConfig,
  ArrayFieldConfig,
  BlockDefinition,
  BlocksFieldConfig,
  CollectionConfig,
  CollectionLabels,
  VersionsConfig,
  GlobalConfig,
  CollectionRegistry,
  GlobalRegistry,
  InferFieldType,
  InferFieldsType
} from './schema/index.js'

export {
  generateZodSchema,
  generatePartialSchema,
  isValidSlug,
  isValidEmail
} from './validation/index.js'

export {
  WhereOperator,
  createQueryBuilder,
  getColumnType,
  getColumnConstraints,
  generateCreateTable,
  generateCreateTableSql,
  generateAlterTableSql
} from './db/index.js'

export type {
  WhereCondition,
  WhereClause,
  OrderByClause,
  PaginatedResult,
  QueryBuilderFactory,
  CollectionQueryBuilder,
  MigrationOutput,
  SchemaChanges,
  SqlValue,
  DocumentRow,
  DocumentData
} from './db/index.js'

export { resolveAccess } from './access/index.js'
export type {
  AccessControlFunction,
  AccessArgs,
  CollectionAccess,
  FieldAccess
} from './access/index.js'

export { runHooks } from './hooks/index.js'
export type {
  HookFunction,
  HookArgs,
  HookData,
  CollectionHooks,
  FieldHooks
} from './hooks/index.js'

export {
  isAuthEnabled,
  getAuthConfig,
  getAuthFields,
  injectAuthFields,
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  destroySession,
  buildSessionCookie,
  buildExpiredSessionCookie,
  createAuthMiddleware,
  createCmsAuthValidator,
  createCmsAuthGuard,
  generateCsrfToken,
  validateCsrfToken,
  createAuthRoutes
} from './auth/index.js'
export type { AuthConfig, AuthContext, AuthMiddleware, CmsAuthGuardOptions } from './auth/index.js'
export { createRateLimiter, parseCookie } from './auth/index.js'
export type { RateLimiter } from './auth/index.js'

export { createLocalApi, createRestRoutes, sendJson, sendErrorJson, safeReadBody, safeJsonParse } from './api/index.js'
export type { LocalApi, RestRouteHandler, RestRouteEntry } from './api/index.js'

export {
  renderLayout,
  renderDashboard,
  renderListView,
  renderEditView,
  renderFieldInput,
  renderLoginPage,
  renderAnalyticsView,
  createAdminRoutes,
  escapeHtml
} from './admin/index.js'

export { isUploadEnabled, getMediaFields, getMimeType, createServeHandler, createUploadHandler } from './media/index.js'
export type { UploadResult } from './media/index.js'

export { buildCms } from './config/index.js'
export type { CmsConfig, CmsInstance, Plugin } from './config/index.js'
