import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initTelemetry } from '../init.js'
import { TelemetryErrorCode } from '@valencets/core'

describe('initTelemetry autoPageview', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid' as ReturnType<typeof crypto.randomUUID>)
    vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fires PAGEVIEW by default', () => {
    const result = initTelemetry({
      endpoint: '/api/telemetry',
      siteId: 'test-site',
      bufferSize: 16,
      flushIntervalMs: 999999
    })
    expect(result.isOk()).toBe(true)
    const handle = result._unsafeUnwrap()

    const flushResult = handle.flushNow()
    expect(flushResult.isOk()).toBe(true)
    expect(flushResult._unsafeUnwrap()).toBe(1)

    handle.destroy()
  })

  it('skips PAGEVIEW when autoPageview is false', () => {
    const result = initTelemetry({
      endpoint: '/api/telemetry',
      siteId: 'test-site',
      autoPageview: false,
      bufferSize: 16,
      flushIntervalMs: 999999
    })
    expect(result.isOk()).toBe(true)
    const handle = result._unsafeUnwrap()

    const flushResult = handle.flushNow()
    expect(flushResult.isErr()).toBe(true)
    expect(flushResult._unsafeUnwrapErr().code).toBe(TelemetryErrorCode.FLUSH_EMPTY)

    handle.destroy()
  })
})
