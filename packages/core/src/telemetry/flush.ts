import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import { TelemetryErrorCode } from './intent-types.js'
import type { TelemetryError } from './intent-types.js'
import type { TelemetryRingBuffer } from './ring-buffer.js'

export interface FlushHandle {
  stop (): void
  flushNow (): Result<number, TelemetryError>
}

export function flushTelemetry (
  buffer: TelemetryRingBuffer,
  endpointUrl: string
): Result<number, TelemetryError> {
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

  buffer.markFlushed(dirty.length)
  return ok(dirty.length)
}

export function scheduleAutoFlush (
  buffer: TelemetryRingBuffer,
  endpointUrl: string,
  intervalMs: number = 30000,
  onFlush?: (count: number) => void
): FlushHandle {
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

  return {
    stop () {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    },
    flushNow () {
      return flushTelemetry(buffer, endpointUrl)
    }
  }
}
