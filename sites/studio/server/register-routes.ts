import type { Router } from './router.js'
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
import { fleetSitesHandler, fleetComparisonHandler } from '../features/admin/server/fleet-routes.js'
import { aggregationHandler } from '../features/admin/server/aggregation-handler.js'
import { loadConfig } from './config.js'
import { sendHtml } from './router.js'

export function registerRoutes (router: Router): void {
  const config = loadConfig()

  // Infrastructure
  router.register('/health', { GET: (_req, res) => sendHtml(res, 'OK') })

  // Content pages
  router.register('/', { GET: homeHandler })
  router.register('/principles', { GET: principlesHandler })
  router.register('/about', { GET: aboutHandler })
  router.register('/services', { GET: servicesHandler })
  router.register('/contact', { GET: contactGetHandler, POST: contactPostHandler })
  router.register('/audit', { GET: auditGetHandler, POST: auditPostHandler })

  // Admin
  router.register('/admin/hud', { GET: createHudHandler(config.adminToken), POST: createHudPostHandler(config.adminToken) })
  router.register('/admin/fleet', { GET: createFleetOverviewHandler(config.adminToken) })
  router.register('/admin/fleet/compare', { GET: createFleetCompareHandler(config.adminToken) })

  // Fleet APIs
  router.register('/api/fleet/sites', { GET: fleetSitesHandler })
  router.register('/api/fleet/compare', { GET: fleetComparisonHandler })

  // Aggregation API (HMAC-verified, not cookie-auth)
  router.register('/api/aggregation', { POST: aggregationHandler })

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
