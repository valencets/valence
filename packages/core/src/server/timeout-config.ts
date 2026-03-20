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

export function resolveTimeoutConfig (config?: TimeoutConfig): ResolvedTimeoutConfig {
  return {
    headersTimeout: config?.headersTimeout ?? DEFAULT_HEADERS_TIMEOUT,
    requestTimeout: config?.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT
  }
}

export function applyTimeouts (server: Server, config: ResolvedTimeoutConfig): void {
  server.headersTimeout = config.headersTimeout
  server.requestTimeout = config.requestTimeout
}
