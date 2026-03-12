import type { ServerRouter } from './router.js'
import { homeHandler } from '../features/home/server/home-handler.js'
import { principlesHandler } from '../features/principles/server/principles-handler.js'
import { aboutHandler } from '../features/about/server/about-handler.js'
import { servicesHandler } from '../features/services/server/services-handler.js'
import { contactGetHandler, contactPostHandler } from '../features/contact/server/contact-handler.js'
import { notFoundHandler } from '../features/not-found/server/not-found-handler.js'
import { telemetryHandler } from '../features/telemetry/server/telemetry-handler.js'
import { sessionHandler } from '../features/telemetry/server/session-handler.js'
import { auditGetHandler, auditPostHandler } from '../features/audit/server/audit-handler.js'
import { createHudHandler, createHudPostHandler } from '../features/admin/server/hud-handler.js'
import { sessionSummaryHandler, eventSummaryHandler, conversionSummaryHandler, ingestionHealthHandler } from '../features/admin/server/summary-routes.js'
import { createFleetOverviewHandler, createFleetCompareHandler } from '../features/admin/server/fleet-handler.js'
import { fleetSitesHandler, fleetComparisonHandler, fleetAggregatesHandler, fleetAlertsHandler } from '../features/admin/server/fleet-routes.js'
import { breakdownPagesHandler, breakdownSourcesHandler, breakdownActionsHandler } from '../features/admin/server/breakdown-routes.js'
import { aggregationHandler } from '../features/admin/server/aggregation-handler.js'
import type { RouteHandler } from '@inertia/core/server'
import type { RouteContext } from './types.js'
import { loadConfig } from './config.js'
import { sendHtml } from './router.js'

function redirect301 (location: string): RouteHandler<RouteContext> {
  return async (_req, res) => {
    res.writeHead(301, { Location: location })
    res.end()
  }
}

export function registerRoutes (router: ServerRouter<RouteContext>): void {
  const config = loadConfig()

  // Infrastructure
  router.register('/health', { GET: async (_req, res) => sendHtml(res, 'OK') })

  // Content pages
  router.register('/', { GET: homeHandler })
  router.register('/how-it-works', { GET: principlesHandler })
  router.register('/about', { GET: aboutHandler })
  router.register('/pricing', { GET: servicesHandler })
  router.register('/contact', { GET: contactGetHandler, POST: contactPostHandler })
  router.register('/free-site-audit', { GET: auditGetHandler, POST: auditPostHandler })

  // 301 redirects from old routes
  router.register('/principles', { GET: redirect301('/how-it-works') })
  router.register('/services', { GET: redirect301('/pricing') })
  router.register('/audit', { GET: redirect301('/free-site-audit') })

  // Admin
  router.register('/admin/hud', { GET: createHudHandler(config.adminToken), POST: createHudPostHandler(config.adminToken) })
  router.register('/admin/fleet', { GET: createFleetOverviewHandler(config.adminToken) })
  router.register('/admin/fleet/compare', { GET: createFleetCompareHandler(config.adminToken) })

  // Fleet APIs
  router.register('/api/fleet/sites', { GET: fleetSitesHandler })
  router.register('/api/fleet/aggregates', { GET: fleetAggregatesHandler })
  router.register('/api/fleet/alerts', { GET: fleetAlertsHandler })
  router.register('/api/fleet/compare', { GET: fleetComparisonHandler })

  // Aggregation API (HMAC-verified, not cookie-auth)
  router.register('/api/aggregation', { POST: aggregationHandler })

  // Breakdown APIs
  router.register('/api/breakdowns/pages', { GET: breakdownPagesHandler })
  router.register('/api/breakdowns/sources', { GET: breakdownSourcesHandler })
  router.register('/api/breakdowns/actions', { GET: breakdownActionsHandler })

  // Summary APIs
  router.register('/api/summaries/sessions', { GET: sessionSummaryHandler })
  router.register('/api/summaries/events', { GET: eventSummaryHandler })
  router.register('/api/summaries/conversions', { GET: conversionSummaryHandler })
  router.register('/api/diagnostics/ingestion', { GET: ingestionHealthHandler })

  // Telemetry API
  router.register('/api/telemetry', { POST: telemetryHandler })
  router.register('/api/session', { POST: sessionHandler })

  // 404 fallback
  router.register('/404', { GET: notFoundHandler })
}
