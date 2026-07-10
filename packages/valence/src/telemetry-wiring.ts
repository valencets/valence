import type { DbPool } from '@valencets/db'
import { createIngestionHandler } from '@valencets/telemetry'
import type { RouteHandler } from './define-config.js'

export interface TelemetryWiringConfig {
  readonly enabled: boolean
  readonly endpoint: string
  readonly siteId: string
}

/**
 * #349 — mount the beacon ingestion endpoint the config promises. The
 * client telemetry engine beacons to `telemetry.endpoint`; without this
 * mount every beacon fell through to the 404 handler and the analytics
 * tables never filled. Registered as a custom route so it wins over the
 * REST `/api/:slug` pattern.
 */
export function maybeRegisterTelemetry (
  telemetry: TelemetryWiringConfig | undefined,
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  pool: DbPool,
  logFn?: (msg: string) => void
): boolean {
  if (telemetry === undefined || !telemetry.enabled) return false

  const handler = createIngestionHandler({ pool })
  registerRoute('POST', telemetry.endpoint, async (req, res) => {
    await handler(req, res)
  })

  if (logFn) logFn(`Telemetry ingestion mounted at ${telemetry.endpoint}`)
  return true
}
