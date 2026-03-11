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
import { loadConfig } from './config.js'

export function registerRoutes (router: Router): void {
  const config = loadConfig()

  // Content pages
  router.register('/', { GET: homeHandler })
  router.register('/principles', { GET: principlesHandler })
  router.register('/about', { GET: aboutHandler })
  router.register('/services', { GET: servicesHandler })
  router.register('/contact', { GET: contactGetHandler, POST: contactPostHandler })
  router.register('/audit', { GET: auditGetHandler, POST: auditPostHandler })

  // Admin
  router.register('/admin/hud', { GET: createHudHandler(config.adminToken), POST: createHudPostHandler(config.adminToken) })

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
