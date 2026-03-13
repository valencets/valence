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

  // Schedule auto-flush with visual feedback
  function onFlush (count: number): void {
    const strip = document.querySelector('inertia-buffer-strip') as
      (HTMLElement & { showFlushMessage?: (n: number) => void }) | null
    if (strip?.showFlushMessage) {
      strip.showFlushMessage(count)
    }
  }

  const flushHandle = scheduleAutoFlush(
    buffer,
    TELEMETRY_CONFIG.endpoint,
    TELEMETRY_CONFIG.flushIntervalMs,
    onFlush
  )

  // Expose for Glass Box components
  ;(window as unknown as Record<string, unknown>).__inertiaBuffer = buffer
  ;(window as unknown as Record<string, unknown>).__inertiaFlush = flushHandle
}

let sessionEnsured = false

export function ensureSession (): void {
  // Check the non-HttpOnly has_session cookie (session_id is HttpOnly, invisible to JS)
  if (sessionEnsured || document.cookie.includes('has_session=')) {
    return
  }
  sessionEnsured = true

  // Send document.referrer in body — the HTTP Referer header always points to the
  // current page, not the actual external referrer
  const referrer = document.referrer.length > 0 ? document.referrer : null
  const body = JSON.stringify({ referrer })

  const beacon = navigator.sendBeacon(TELEMETRY_CONFIG.sessionEndpoint, body)
  if (!beacon) {
    fetch(TELEMETRY_CONFIG.sessionEndpoint, {
      method: 'POST',
      keepalive: true,
      body,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
