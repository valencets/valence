/**
 * Privacy consent checks for client-side telemetry.
 *
 * Checks (in order):
 * 1. Do Not Track (navigator.doNotTrack === '1')
 * 2. Global Privacy Control (navigator.globalPrivacyControl === true)
 * 3. Developer opt-out flag (window.__valence_telemetry_consent === false)
 *
 * All three must pass for telemetry to be sent.
 */

interface NavigatorWithGPC extends Navigator {
  readonly globalPrivacyControl?: boolean
}

export function shouldTrack (): boolean {
  // Check Do Not Track
  if (navigator.doNotTrack === '1') return false

  // Check Global Privacy Control
  if ((navigator as NavigatorWithGPC).globalPrivacyControl === true) return false

  // Check developer opt-out flag
  if ('__valence_telemetry_consent' in globalThis &&
      (globalThis as { __valence_telemetry_consent?: boolean }).__valence_telemetry_consent === false) return false

  return true
}
