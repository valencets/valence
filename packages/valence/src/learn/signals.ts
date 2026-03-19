import type { LearnSignals } from './types.js'

export function createLearnSignals (): LearnSignals {
  return {
    adminPageViews: 0,
    apiGetRequests: 0,
    configChangeDetected: false
  }
}

export function incrementAdminViews (signals: LearnSignals): void {
  signals.adminPageViews += 1
}

export function incrementApiGets (signals: LearnSignals): void {
  signals.apiGetRequests += 1
}

export function markConfigChanged (signals: LearnSignals): void {
  signals.configChangeDetected = true
}
