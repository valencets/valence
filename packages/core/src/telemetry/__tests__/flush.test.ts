import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushTelemetry, scheduleAutoFlush } from '../flush.js'
import { TelemetryRingBuffer } from '../ring-buffer.js'
import { IntentType } from '../intent-types.js'
import type { FlushHandle } from '../flush.js'

describe('flushTelemetry', () => {
  let buffer: TelemetryRingBuffer

  beforeEach(() => {
    const result = TelemetryRingBuffer.create(64)
    if (result.isErr()) {
      throw new Error('Failed to create buffer for test')
    }
    buffer = result.value

    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockReturnValue(true),
      doNotTrack: null
    })
    delete (globalThis as Record<string, unknown>).__valence_telemetry_consent
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as Record<string, unknown>).__valence_telemetry_consent
  })

  it('returns Err(FLUSH_EMPTY) when buffer is empty', () => {
    const result = flushTelemetry(buffer, '/api/telemetry')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FLUSH_EMPTY')
    }
  })

  it('calls sendBeacon with correct URL and valid JSON payload', () => {
    buffer.write(IntentType.CLICK, 'button.cta', 100, 200, 1000)
    buffer.write(IntentType.SCROLL, 'section.hero', 0, 500, 2000)

    const result = flushTelemetry(buffer, '/api/telemetry')
    expect(result.isOk()).toBe(true)

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)
    const [url, payload] = (navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string]
    expect(url).toBe('/api/telemetry')

    const parsed = JSON.parse(payload) as Array<Record<string, unknown>>
    expect(parsed).toHaveLength(2)
    expect(parsed[0]!.type).toBe('CLICK')
    expect(parsed[0]!.targetDOMNode).toBe('button.cta')
    expect(parsed[1]!.type).toBe('SCROLL')
  })

  it('returns Ok(count) on success', () => {
    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    buffer.write(IntentType.CLICK, 'b', 0, 0, 2)
    buffer.write(IntentType.CLICK, 'c', 0, 0, 3)

    const result = flushTelemetry(buffer, '/api/t')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe(3)
    }
  })

  it('marks slots clean after successful flush', () => {
    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    buffer.write(IntentType.CLICK, 'b', 0, 0, 2)

    flushTelemetry(buffer, '/api/t')
    expect(buffer.count).toBe(0)
    expect(buffer.collectDirty()).toHaveLength(0)
  })

  it('returns Err(FLUSH_DISPATCH_FAILED) when sendBeacon returns false', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockReturnValue(false)
    })

    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    const result = flushTelemetry(buffer, '/api/t')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FLUSH_DISPATCH_FAILED')
    }
  })

  it('does not mark slots clean on failed dispatch', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockReturnValue(false)
    })

    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    flushTelemetry(buffer, '/api/t')
    expect(buffer.count).toBe(1)
    expect(buffer.collectDirty()).toHaveLength(1)
  })

  it('handles large buffer (1024 slots) with valid payload', () => {
    const bigResult = TelemetryRingBuffer.create(1024)
    if (bigResult.isErr()) throw new Error('Failed to create large buffer')
    const bigBuffer = bigResult.value

    for (let i = 0; i < 1024; i++) {
      bigBuffer.write(IntentType.CLICK, `el-${i}`, i, i, i * 1000)
    }

    const result = flushTelemetry(bigBuffer, '/api/t')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe(1024)
    }

    const [, payload] = (navigator.sendBeacon as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string]
    const parsed = JSON.parse(payload) as unknown[]
    expect(parsed).toHaveLength(1024)
  })

  it('returns Err(FLUSH_CONSENT_DENIED) when Do Not Track is set', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockReturnValue(true),
      doNotTrack: '1'
    })

    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    const result = flushTelemetry(buffer, '/api/t')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FLUSH_CONSENT_DENIED')
    }
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
  })

  it('returns Err(FLUSH_CONSENT_DENIED) when GPC is set', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockReturnValue(true),
      doNotTrack: null,
      globalPrivacyControl: true
    })

    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    const result = flushTelemetry(buffer, '/api/t')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FLUSH_CONSENT_DENIED')
    }
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
  })

  it('returns Err(FLUSH_CONSENT_DENIED) when consent flag is false', () => {
    (globalThis as Record<string, unknown>).__valence_telemetry_consent = false

    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    const result = flushTelemetry(buffer, '/api/t')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FLUSH_CONSENT_DENIED')
    }
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
  })

  it('does not consume buffer entries when consent is denied', () => {
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockReturnValue(true),
      doNotTrack: '1'
    })

    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    flushTelemetry(buffer, '/api/t')
    // Buffer entries should still be dirty since we never attempted to send
    expect(buffer.count).toBe(1)
  })
})

describe('scheduleAutoFlush', () => {
  let buffer: TelemetryRingBuffer
  let flushHandle: FlushHandle | null

  beforeEach(() => {
    const result = TelemetryRingBuffer.create(64)
    if (result.isErr()) throw new Error('Failed to create buffer')
    buffer = result.value
    flushHandle = null

    vi.useFakeTimers()
    vi.stubGlobal('navigator', {
      sendBeacon: vi.fn().mockReturnValue(true),
      doNotTrack: null
    })
    delete (globalThis as Record<string, unknown>).__valence_telemetry_consent
  })

  afterEach(() => {
    if (flushHandle) flushHandle.stop()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete (globalThis as Record<string, unknown>).__valence_telemetry_consent
  })

  it('sets interval and flushes at specified interval', () => {
    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    flushHandle = scheduleAutoFlush(buffer, '/api/t', 5000)

    vi.advanceTimersByTime(5000)
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)
  })

  it('stop clears the interval', () => {
    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    flushHandle = scheduleAutoFlush(buffer, '/api/t', 5000)
    flushHandle.stop()
    flushHandle = null

    buffer.write(IntentType.CLICK, 'b', 0, 0, 2)
    vi.advanceTimersByTime(10000)
    expect(navigator.sendBeacon).not.toHaveBeenCalled()
  })

  it('flushNow triggers immediate flush', () => {
    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    flushHandle = scheduleAutoFlush(buffer, '/api/t', 30000)

    const result = flushHandle.flushNow()
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe(1)
    }
    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)
  })

  it('visibilitychange to hidden triggers flush', () => {
    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    flushHandle = scheduleAutoFlush(buffer, '/api/t', 30000)

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new Event('visibilitychange'))

    expect(navigator.sendBeacon).toHaveBeenCalledTimes(1)

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    })
  })

  it('calls onFlush callback with count after successful interval flush', () => {
    const onFlush = vi.fn()
    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    buffer.write(IntentType.CLICK, 'b', 0, 0, 2)
    flushHandle = scheduleAutoFlush(buffer, '/api/t', 5000, onFlush)

    vi.advanceTimersByTime(5000)
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith(2)
  })

  it('does not call onFlush when flush has no dirty entries', () => {
    const onFlush = vi.fn()
    flushHandle = scheduleAutoFlush(buffer, '/api/t', 5000, onFlush)

    vi.advanceTimersByTime(5000)
    expect(onFlush).not.toHaveBeenCalled()
  })

  it('calls onFlush on visibilitychange flush', () => {
    const onFlush = vi.fn()
    buffer.write(IntentType.CLICK, 'a', 0, 0, 1)
    flushHandle = scheduleAutoFlush(buffer, '/api/t', 30000, onFlush)

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true
    })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onFlush).toHaveBeenCalledWith(1)

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true
    })
  })
})
