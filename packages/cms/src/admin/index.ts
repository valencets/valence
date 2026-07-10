export { renderAdminLayout } from './layout.js'
export { renderDashboard } from './dashboard.js'
export { renderListView } from './list-view.js'
export { renderEditView } from './edit-view.js'
export { renderFieldInput } from './field-renderers.js'
export { createAdminRoutes } from './admin-routes.js'
export { escapeHtml } from './escape.js'
export { renderLoginPage } from './login-view.js'
export { renderAnalyticsView } from './analytics-view.js'

export { renderRevisionList, renderRevisionDiff } from './revision-view.js'
export { getAdminStyles, ADMIN_THEME_CSS } from './admin-styles.js'
// #337 — argument/result types referenced by the exported render functions
export type { LayoutArgs } from './layout.js'
export type { DashboardData } from './dashboard.js'
export type { ListViewArgs } from './list-view.js'
export type { DocRow, EditViewLocaleConfig } from './edit-view.js'
export type { RelationContext, UploadContext } from './field-renderers.js'
export type { AdminOptions } from './admin-routes.js'
export type { LoginPageArgs } from './login-view.js'
export type { AnalyticsData } from './analytics-view.js'
export type { CollectionStat } from './dashboard.js'
export type { ListViewPagination, ListViewLocaleConfig } from './list-view.js'
// Aliased: query-builder's DocumentRow owns the bare name
export type { DocumentRow as ListViewDocumentRow } from './list-view.js'
export type { RelationOption, SizeVariant } from './field-renderers.js'
export type { FlashMessage } from './flash.js'
export type {
  TopPageEntry,
  TopReferrerEntry,
  EventCategoryEntry,
  PageviewEntry,
  DailyEventEntry
} from './analytics-view.js'
export type { RecentItem } from './dashboard.js'
