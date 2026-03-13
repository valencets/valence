// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let originalCookie: PropertyDescriptor | undefined

beforeEach(() => {
  originalCookie = Object.getOwnPropertyDescriptor(document, 'cookie')
  vi.stubGlobal('navigator', {
    ...navigator,
    sendBeacon: vi.fn(() => true)
  })
})

afterEach(() => {
  if (originalCookie) {
    Object.defineProperty(document, 'cookie', originalCookie)
  }
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('ensureSession', () => {
  it('checks has_session cookie, not session_id (which is HttpOnly)', async () => {
    // Simulate: has_session=1 is visible to JS (not HttpOnly)
    Object.defineProperty(document, 'cookie', {
      get: () => 'has_session=1',
      configurable: true
    })

    vi.doMock('../config/telemetry-config.js', () => ({
      TELEMETRY_CONFIG: {
        bufferCapacity: 64,
        flushIntervalMs: 10000,
        highWaterMark: 64,
        endpoint: '/api/telemetry',
        sessionEndpoint: '/api/session'
      }
    }))

    // ensureSession should NOT fire when has_session=1 is present
    const { ensureSession } = await import('../telemetry-boot.js')
    ensureSession()

    expect(navigator.sendBeacon).not.toHaveBeenCalled()
  })

  it('fires session creation when has_session cookie is absent', async () => {
    Object.defineProperty(document, 'cookie', {
      get: () => '',
      configurable: true
    })

    vi.doMock('../config/telemetry-config.js', () => ({
      TELEMETRY_CONFIG: {
        bufferCapacity: 64,
        flushIntervalMs: 10000,
        highWaterMark: 64,
        endpoint: '/api/telemetry',
        sessionEndpoint: '/api/session'
      }
    }))

    const { ensureSession } = await import('../telemetry-boot.js')
    ensureSession()

    expect(navigator.sendBeacon).toHaveBeenCalledWith('/api/session', expect.any(String))
  })

  it('sends document.referrer in beacon body for accurate referrer tracking', async () => {
    Object.defineProperty(document, 'cookie', {
      get: () => '',
      configurable: true
    })
    Object.defineProperty(document, 'referrer', {
      get: () => 'https://google.com/search?q=barbershop',
      configurable: true
    })

    vi.doMock('../config/telemetry-config.js', () => ({
      TELEMETRY_CONFIG: {
        bufferCapacity: 64,
        flushIntervalMs: 10000,
        highWaterMark: 64,
        endpoint: '/api/telemetry',
        sessionEndpoint: '/api/session'
      }
    }))

    const { ensureSession } = await import('../telemetry-boot.js')
    ensureSession()

    const body = (navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string
    const parsed = JSON.parse(body)
    expect(parsed.referrer).toBe('https://google.com/search?q=barbershop')
  })

  it('sends null referrer for direct traffic', async () => {
    Object.defineProperty(document, 'cookie', {
      get: () => '',
      configurable: true
    })
    Object.defineProperty(document, 'referrer', {
      get: () => '',
      configurable: true
    })

    vi.doMock('../config/telemetry-config.js', () => ({
      TELEMETRY_CONFIG: {
        bufferCapacity: 64,
        flushIntervalMs: 10000,
        highWaterMark: 64,
        endpoint: '/api/telemetry',
        sessionEndpoint: '/api/session'
      }
    }))

    const { ensureSession } = await import('../telemetry-boot.js')
    ensureSession()

    const body = (navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as string
    const parsed = JSON.parse(body)
    expect(parsed.referrer).toBeNull()
  })

  it('only fires session creation once per page load', async () => {
    Object.defineProperty(document, 'cookie', {
      get: () => '',
      configurable: true
    })

    vi.doMock('../config/telemetry-config.js', () => ({
      TELEMETRY_CONFIG: {
        bufferCapacity: 64,
        flushIntervalMs: 10000,
        highWaterMark: 64,
        endpoint: '/api/telemetry',
        sessionEndpoint: '/api/session'
      }
    }))

    const { ensureSession } = await import('../telemetry-boot.js')
    ensureSession()
    ensureSession()
    ensureSession()

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)
  })
})
