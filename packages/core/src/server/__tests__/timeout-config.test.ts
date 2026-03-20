import { describe, it, expect } from 'vitest'
import type { Server } from 'node:http'
import { resolveTimeoutConfig, applyTimeouts } from '../timeout-config.js'

describe('resolveTimeoutConfig', () => {
  it('returns defaults when no config provided', () => {
    const config = resolveTimeoutConfig()
    expect(config).toEqual({ headersTimeout: 10_000, requestTimeout: 30_000 })
  })

  it('merges partial config with defaults', () => {
    const config = resolveTimeoutConfig({ headersTimeout: 5000 })
    expect(config).toEqual({ headersTimeout: 5000, requestTimeout: 30_000 })
  })

  it('overrides both values', () => {
    const config = resolveTimeoutConfig({ headersTimeout: 3000, requestTimeout: 15_000 })
    expect(config).toEqual({ headersTimeout: 3000, requestTimeout: 15_000 })
  })
})

describe('applyTimeouts', () => {
  it('sets headersTimeout and requestTimeout on server', () => {
    const server = { headersTimeout: 0, requestTimeout: 0 } as Server
    const config = resolveTimeoutConfig({ headersTimeout: 8000, requestTimeout: 20_000 })

    applyTimeouts(server, config)

    expect(server.headersTimeout).toBe(8000)
    expect(server.requestTimeout).toBe(20_000)
  })

  it('sets default values when using default config', () => {
    const server = { headersTimeout: 0, requestTimeout: 0 } as Server
    applyTimeouts(server, resolveTimeoutConfig())

    expect(server.headersTimeout).toBe(10_000)
    expect(server.requestTimeout).toBe(30_000)
  })
})
