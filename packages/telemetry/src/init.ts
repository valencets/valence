import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import {
  TelemetryRingBuffer,
  initEventDelegation,
  scheduleAutoFlush,
  IntentType,
  shouldTrack
} from '@valencets/core/client'
import type { TelemetryError } from '@valencets/core/client'

export interface TelemetryConfig {
  readonly endpoint: string
  readonly siteId: string
  readonly bufferSize?: number | undefined
  readonly flushIntervalMs?: number | undefined
  readonly rootElement?: HTMLElement | undefined
  readonly autoPageview?: boolean | undefined
}

export interface TelemetryHandle {
  readonly destroy: () => void
  readonly flushNow: () => Result<number, TelemetryError>
}

const DEFAULT_BUFFER_SIZE = 256
const DEFAULT_FLUSH_INTERVAL_MS = 10_000

export function initTelemetry (config: TelemetryConfig): Result<TelemetryHandle, TelemetryError> {
  const bufferSize = config.bufferSize ?? DEFAULT_BUFFER_SIZE
  const flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS

  const bufferResult = TelemetryRingBuffer.create(bufferSize)
  if (bufferResult.isErr()) {
    return err(bufferResult.error)
  }
  const buffer = bufferResult.value

  const delegationResult = initEventDelegation(buffer, config.rootElement)
  if (delegationResult.isErr()) {
    return err(delegationResult.error)
  }
  const delegation = delegationResult.value

  const flushResult = scheduleAutoFlush(buffer, config.endpoint, flushIntervalMs)
  if (flushResult.isErr()) {
    return err(flushResult.error)
  }
  const flush = flushResult.value

  const autoPageview = config.autoPageview ?? true
  if (autoPageview && shouldTrack()) {
    const writeResult = buffer.write(
      IntentType.PAGEVIEW,
      'document',
      0,
      0,
      Date.now()
    )
    if (writeResult.isOk()) {
      const slot = writeResult.value
      slot.site_id = config.siteId
      slot.path = globalThis.location?.pathname ?? ''
      slot.referrer = globalThis.document?.referrer ?? ''
    }
  }

  return ok({
    destroy: () => {
      flush.stop()
      delegation.destroy()
    },
    flushNow: () => flush.flushNow()
  })
}
