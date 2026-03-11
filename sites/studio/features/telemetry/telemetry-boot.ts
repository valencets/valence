// Client-side telemetry boot script
// This runs in the browser — creates ring buffer, sets up event delegation,
// schedules auto-flush via sendBeacon

import { TelemetryRingBuffer } from '@inertia/core'
import { initEventDelegation } from '@inertia/core'
import { scheduleAutoFlush } from '@inertia/core'
import { TELEMETRY_CONFIG } from './config/telemetry-config.js'

export function bootTelemetry (): void {
  const bufferResult = TelemetryRingBuffer.create(TELEMETRY_CONFIG.bufferCapacity)

  if (bufferResult.isErr()) {
    console.error('[telemetry] Buffer init failed:', bufferResult.error.message)
    return
  }

  const buffer = bufferResult.value

  // Ensure session exists
  ensureSession()

  // Init event delegation on document.body
  initEventDelegation(buffer, document.body)

  // Schedule auto-flush
  const flushHandle = scheduleAutoFlush(
    buffer,
    TELEMETRY_CONFIG.endpoint,
    TELEMETRY_CONFIG.flushIntervalMs
  )

  // Expose for Glass Box components
  ;(window as unknown as Record<string, unknown>).__inertiaBuffer = buffer
  ;(window as unknown as Record<string, unknown>).__inertiaFlush = flushHandle
}

function ensureSession (): void {
  if (document.cookie.includes('session_id=')) {
    return
  }

  // Fire-and-forget session creation
  const beacon = navigator.sendBeacon(TELEMETRY_CONFIG.sessionEndpoint, '')
  if (!beacon) {
    // Fallback: fetch
    fetch(TELEMETRY_CONFIG.sessionEndpoint, { method: 'POST', keepalive: true })
  }
}
