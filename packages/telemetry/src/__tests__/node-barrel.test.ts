// @vitest-environment node
import { describe, it, expect } from 'vitest'

// #349 audit — the barrel pulled @valencets/core/client (router included),
// whose Web Component classes evaluate DOM globals at import time. Any
// plain-node consumer crashed: `valence telemetry:aggregate` dynamic-imports
// this barrel and has been broken since init.ts landed. The barrel must
// import cleanly in a DOM-less runtime; DOM is a call-time concern of
// initTelemetry only.

describe('@valencets/telemetry barrel in a DOM-less runtime', () => {
  it('imports without a DOM', async () => {
    const mod = await import('../index.js')
    expect(typeof mod.createIngestionHandler).toBe('function')
    expect(typeof mod.initTelemetry).toBe('function')
    expect(typeof mod.aggregateSessionSummary).toBe('function')
  })
})
