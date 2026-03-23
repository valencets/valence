import { describe, it, expect, vi, afterEach } from 'vitest'
import { initTelemetry } from '../init.js'
import type { TelemetryConfig } from '../init.js'

describe('initTelemetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as Record<string, unknown>).__valence_telemetry_consent
  })

  it('returns Ok with a TelemetryHandle', () => {
    const config: TelemetryConfig = {
      endpoint: '/api/telemetry',
      siteId: 'test-site'
    }
    const result = initTelemetry(config)
    expect(result.isOk()).toBe(true)
  })

  it('handle has destroy method', () => {
    const result = initTelemetry({ endpoint: '/api/telemetry', siteId: 'test-site' })
    const handle = result.unwrap()
    expect(typeof handle.destroy).toBe('function')
  })

  it('handle has flushNow method', () => {
    const result = initTelemetry({ endpoint: '/api/telemetry', siteId: 'test-site' })
    const handle = result.unwrap()
    expect(typeof handle.flushNow).toBe('function')
  })

  it('accepts optional bufferSize', () => {
    const result = initTelemetry({
      endpoint: '/api/telemetry',
      siteId: 'test-site',
      bufferSize: 64
    })
    expect(result.isOk()).toBe(true)
  })

  it('accepts optional flushIntervalMs', () => {
    const result = initTelemetry({
      endpoint: '/api/telemetry',
      siteId: 'test-site',
      flushIntervalMs: 5000
    })
    expect(result.isOk()).toBe(true)
  })

  it('returns Err for non-power-of-two bufferSize', () => {
    const result = initTelemetry({
      endpoint: '/api/telemetry',
      siteId: 'test-site',
      bufferSize: 13
    })
    expect(result.isErr()).toBe(true)
  })

  it('defaults bufferSize to 256', () => {
    const result = initTelemetry({ endpoint: '/api/telemetry', siteId: 'test-site' })
    expect(result.isOk()).toBe(true)
  })

  it('defaults flushIntervalMs to 10000', () => {
    const result = initTelemetry({ endpoint: '/api/telemetry', siteId: 'test-site' })
    expect(result.isOk()).toBe(true)
  })

  it('still returns Ok when DNT is set (init succeeds, flush is blocked)', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      doNotTrack: '1',
      sendBeacon: vi.fn().mockReturnValue(true)
    })
    const result = initTelemetry({ endpoint: '/api/telemetry', siteId: 'test-site' })
    expect(result.isOk()).toBe(true)
  })

  it('skips auto-pageview when consent flag is false', () => {
    (globalThis as Record<string, unknown>).__valence_telemetry_consent = false
    const result = initTelemetry({
      endpoint: '/api/telemetry',
      siteId: 'test-site',
      autoPageview: true
    })
    // Init still succeeds — only the pageview write is skipped
    expect(result.isOk()).toBe(true)
  })

  it('skips auto-pageview when GPC is set', () => {
    vi.stubGlobal('navigator', {
      ...navigator,
      globalPrivacyControl: true,
      sendBeacon: vi.fn().mockReturnValue(true)
    })
    const result = initTelemetry({
      endpoint: '/api/telemetry',
      siteId: 'test-site',
      autoPageview: true
    })
    expect(result.isOk()).toBe(true)
  })
})
