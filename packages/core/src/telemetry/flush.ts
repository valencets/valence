import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { TelemetryErrorCode } from './intent-types.js'
import type { TelemetryError } from './intent-types.js'
import type { TelemetryRingBuffer } from './ring-buffer.js'
import { shouldTrack } from './consent.js'

export interface FlushHandle {
  stop (): void
  flushNow (): Result<number, TelemetryError>
}

const VALID_URL_PREFIX = /^(https?:\/\/|\/[^/])/

export function isValidBeaconUrl (url: string): boolean {
  if (url.length === 0) return false
  return VALID_URL_PREFIX.test(url)
}

export function flushTelemetry (
  buffer: TelemetryRingBuffer,
  endpointUrl: string
): Result<number, TelemetryError> {
  if (!shouldTrack()) {
    return err({
      code: TelemetryErrorCode.FLUSH_CONSENT_DENIED,
      message: 'Telemetry blocked by privacy signal'
    })
  }

  if (!isValidBeaconUrl(endpointUrl)) {
    return err({
      code: TelemetryErrorCode.FLUSH_DISPATCH_FAILED,
      message: `Invalid beacon URL: ${endpointUrl}`
    })
  }

  const dirty = buffer.collectDirty()

  if (dirty.length === 0) {
    return err({
      code: TelemetryErrorCode.FLUSH_EMPTY,
      message: 'No dirty entries to flush'
    })
  }

  const payload = JSON.stringify(dirty)
  const sent = navigator.sendBeacon(endpointUrl, payload)

  if (!sent) {
    return err({
      code: TelemetryErrorCode.FLUSH_DISPATCH_FAILED,
      message: 'sendBeacon returned false'
    })
  }

  const markResult = buffer.markFlushed(dirty.length)
  if (markResult.isErr()) return err(markResult.error)

  return ok(dirty.length)
}

const MIN_FLUSH_INTERVAL_MS = 1000

export function scheduleAutoFlush (
  buffer: TelemetryRingBuffer,
  endpointUrl: string,
  intervalMs: number = 30000,
  onFlush?: (count: number) => void
): Result<FlushHandle, TelemetryError> {
  if (intervalMs < MIN_FLUSH_INTERVAL_MS) {
    return err({
      code: TelemetryErrorCode.INVALID_CAPACITY,
      message: `Flush interval must be >= ${MIN_FLUSH_INTERVAL_MS}ms, got ${intervalMs}`
    })
  }

  function flushAndNotify (): void {
    const result = flushTelemetry(buffer, endpointUrl)
    if (result.isOk() && onFlush) {
      onFlush(result.value)
    }
  }

  const intervalId = setInterval(flushAndNotify, intervalMs)

  function onVisibilityChange (): void {
    if (document.visibilityState === 'hidden') {
      flushAndNotify()
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)

  return ok({
    stop () {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    },
    flushNow () {
      return flushTelemetry(buffer, endpointUrl)
    }
  })
}
