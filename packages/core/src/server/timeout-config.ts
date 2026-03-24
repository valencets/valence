import type { Server } from 'node:http'

export interface TimeoutConfig {
  readonly headersTimeout?: number
  readonly requestTimeout?: number
}

export interface ResolvedTimeoutConfig {
  readonly headersTimeout: number
  readonly requestTimeout: number
}

const DEFAULT_HEADERS_TIMEOUT = 10_000
const DEFAULT_REQUEST_TIMEOUT = 30_000

function resolvePositiveTimeout (value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isFinite(value) || value <= 0) return fallback
  return value
}

export function resolveTimeoutConfig (config?: TimeoutConfig): ResolvedTimeoutConfig {
  return {
    headersTimeout: resolvePositiveTimeout(config?.headersTimeout, DEFAULT_HEADERS_TIMEOUT),
    requestTimeout: resolvePositiveTimeout(config?.requestTimeout, DEFAULT_REQUEST_TIMEOUT)
  }
}

export function applyTimeouts (server: Server, config: ResolvedTimeoutConfig): void {
  server.headersTimeout = config.headersTimeout
  server.requestTimeout = config.requestTimeout
}
