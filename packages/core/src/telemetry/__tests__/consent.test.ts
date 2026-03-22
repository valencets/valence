import { describe, it, expect, vi, afterEach } from 'vitest'
import { shouldTrack } from '../consent.js'

describe('shouldTrack', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as Record<string, unknown>).__valence_telemetry_consent
  })

  it('returns true when no privacy signals are set', () => {
    vi.stubGlobal('navigator', { doNotTrack: null })
    expect(shouldTrack()).toBe(true)
  })

  it('returns false when navigator.doNotTrack is "1"', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    expect(shouldTrack()).toBe(false)
  })

  it('returns true when navigator.doNotTrack is "0"', () => {
    vi.stubGlobal('navigator', { doNotTrack: '0' })
    expect(shouldTrack()).toBe(true)
  })

  it('returns true when navigator.doNotTrack is "unspecified"', () => {
    vi.stubGlobal('navigator', { doNotTrack: 'unspecified' })
    expect(shouldTrack()).toBe(true)
  })

  it('returns false when navigator.globalPrivacyControl is true', () => {
    vi.stubGlobal('navigator', { doNotTrack: null, globalPrivacyControl: true })
    expect(shouldTrack()).toBe(false)
  })

  it('returns true when navigator.globalPrivacyControl is false', () => {
    vi.stubGlobal('navigator', { doNotTrack: null, globalPrivacyControl: false })
    expect(shouldTrack()).toBe(true)
  })

  it('returns true when navigator.globalPrivacyControl is undefined', () => {
    vi.stubGlobal('navigator', { doNotTrack: null })
    expect(shouldTrack()).toBe(true)
  })

  it('returns false when __valence_telemetry_consent is false', () => {
    vi.stubGlobal('navigator', { doNotTrack: null });
    (globalThis as Record<string, unknown>).__valence_telemetry_consent = false
    expect(shouldTrack()).toBe(false)
  })

  it('returns true when __valence_telemetry_consent is true', () => {
    vi.stubGlobal('navigator', { doNotTrack: null });
    (globalThis as Record<string, unknown>).__valence_telemetry_consent = true
    expect(shouldTrack()).toBe(true)
  })

  it('returns true when __valence_telemetry_consent is undefined', () => {
    vi.stubGlobal('navigator', { doNotTrack: null })
    expect(shouldTrack()).toBe(true)
  })

  it('DNT takes priority over consent flag', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' });
    (globalThis as Record<string, unknown>).__valence_telemetry_consent = true
    expect(shouldTrack()).toBe(false)
  })

  it('GPC takes priority over consent flag', () => {
    vi.stubGlobal('navigator', { doNotTrack: null, globalPrivacyControl: true });
    (globalThis as Record<string, unknown>).__valence_telemetry_consent = true
    expect(shouldTrack()).toBe(false)
  })
})
