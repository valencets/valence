import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initTelemetry } from '../init.js'

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { ...crypto, randomUUID: () => 'test-uuid' })

describe('initTelemetry autoPageview', () => {
  beforeEach(() => {
    // happy-dom provides location and document
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
    handle.destroy()
  })
})
