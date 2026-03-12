// Barrel export — named exports only, no default exports

// Types
export type {
  HudError,
  HudPeriod,
  DeltaResult,
  DeviceBreakdown,
  SessionSummary,
  EventSummary,
  ConversionSummary,
  IngestionHealth,
  ReferrerCategory,
  TopPagesData,
  TrafficSourcesData,
  LeadActionsData
} from './types.js'
export { HudErrorCode, HudPeriod as HudPeriodValues } from './types.js'

// Tokens
export { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING, HUD_CHART } from './tokens/hud-tokens.js'
export type { HudColor } from './tokens/hud-tokens.js'

// Components (side-effect registrations)
export { HudSparkline } from './components/HudSparkline.js'
export { HudMetric } from './components/HudMetric.js'
export { HudBar } from './components/HudBar.js'
export { HudTable } from './components/HudTable.js'
export type { HudColumnDef } from './components/HudTable.js'
export { HudStatus } from './components/HudStatus.js'
export { HudTimeRange } from './components/HudTimeRange.js'
export { HudPanel } from './components/HudPanel.js'

// Layouts
export { ClientDashboard } from './layouts/ClientDashboard.js'
export { DiagnosticDashboard } from './layouts/DiagnosticDashboard.js'
export { FleetDashboard } from './layouts/FleetDashboard.js'
export { FleetComparison } from './layouts/FleetComparison.js'

// Data utilities
export { formatDelta } from './data/format-delta.js'
export { formatNumber } from './data/format-number.js'
export { classifyReferrer, aggregateByCategory } from './data/classify-referrer.js'
export type { CategoryCount } from './data/classify-referrer.js'
export { fetchSessionSummary, fetchEventSummary, fetchConversionSummary, fetchIngestionHealth } from './data/fetch-summaries.js'
export { fetchTopPages, fetchTrafficSources, fetchLeadActions } from './data/fetch-breakdowns.js'
export { fetchFleetSites, fetchFleetAggregates, fetchFleetAlerts, fetchFleetComparison } from './data/fetch-fleet.js'
export type { FleetSiteData, FleetAggregateData, FleetAlertData, FleetComparisonData } from './data/fetch-fleet.js'
