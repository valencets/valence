import { describe, it, expect } from 'vitest'
import * as telemetry from '../index.js'

// #337 — `createSession` is exported by both @valencets/cms (auth
// sessions) and @valencets/telemetry (analytics sessions): same name,
// unrelated semantics. The telemetry one gains an unambiguous primary
// name; the old name stays as a deprecated alias until 2.0.

describe('analytics session export naming', () => {
  it('exports createTelemetrySession as the primary name', () => {
    expect(typeof telemetry.createTelemetrySession).toBe('function')
  })

  it('keeps createSession as a deprecated alias of the same function', () => {
    expect(telemetry.createSession).toBe(telemetry.createTelemetrySession)
  })

  it('marks the alias @deprecated in source', async () => {
    const { readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'index.ts'),
      'utf-8'
    )
    expect(source).toContain('@deprecated')
    expect(source).toContain('createTelemetrySession')
  })
})
