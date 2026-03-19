import { describe, it, expect } from 'vitest'
import {
  createLearnSignals,
  incrementAdminViews,
  incrementApiGets,
  markConfigChanged
} from '../signals.js'

describe('createLearnSignals', () => {
  it('returns signals with all counters at zero', () => {
    const signals = createLearnSignals()
    expect(signals.adminPageViews).toBe(0)
    expect(signals.apiGetRequests).toBe(0)
    expect(signals.configChangeDetected).toBe(false)
  })
})

describe('incrementAdminViews', () => {
  it('increments adminPageViews by 1', () => {
    const signals = createLearnSignals()
    incrementAdminViews(signals)
    expect(signals.adminPageViews).toBe(1)
  })

  it('increments cumulatively', () => {
    const signals = createLearnSignals()
    incrementAdminViews(signals)
    incrementAdminViews(signals)
    incrementAdminViews(signals)
    expect(signals.adminPageViews).toBe(3)
  })
})

describe('incrementApiGets', () => {
  it('increments apiGetRequests by 1', () => {
    const signals = createLearnSignals()
    incrementApiGets(signals)
    expect(signals.apiGetRequests).toBe(1)
  })

  it('increments cumulatively', () => {
    const signals = createLearnSignals()
    incrementApiGets(signals)
    incrementApiGets(signals)
    expect(signals.apiGetRequests).toBe(2)
  })
})

describe('markConfigChanged', () => {
  it('sets configChangeDetected to true', () => {
    const signals = createLearnSignals()
    expect(signals.configChangeDetected).toBe(false)
    markConfigChanged(signals)
    expect(signals.configChangeDetected).toBe(true)
  })

  it('remains true after multiple calls', () => {
    const signals = createLearnSignals()
    markConfigChanged(signals)
    markConfigChanged(signals)
    expect(signals.configChangeDetected).toBe(true)
  })
})
