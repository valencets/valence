import { vi } from 'vitest'
import type { DbPool } from '@valencets/db'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Minimal mock interface matching the subset of postgres `Sql` used in tests.
 * Avoids banned `as unknown as` double-cast by typing the mock shape directly.
 */
export interface MockSql {
  (strings: TemplateStringsArray, ...values: readonly (string | number | boolean | null)[]): ReturnType<typeof vi.fn>
  readonly unsafe: ReturnType<typeof vi.fn>
}

/** Cast a MockSql to DbPool['sql']. Single-direction cast is acceptable for test mocks. */
export function asSql (mock: MockSql): DbPool['sql'] {
  return mock as unknown as DbPool['sql']
}

export function makeMockPool (returnValue: readonly Record<string, string | number | null>[] = []): DbPool {
  const unsafe = vi.fn(() => Promise.resolve(returnValue))
  const sql = Object.assign(
    vi.fn(() => Promise.resolve(returnValue)),
    { unsafe }
  ) as MockSql
  return { sql: asSql(sql) }
}

export function makeErrorPool (error: Error): DbPool {
  const unsafe = vi.fn(() => Promise.reject(error))
  const sql = Object.assign(
    vi.fn(() => Promise.reject(error)),
    { unsafe }
  ) as MockSql
  return { sql: asSql(sql) }
}

export function makeSequentialPool (returns: readonly (readonly Record<string, string | number | null>[])[]): DbPool {
  let callIdx = 0
  const unsafe = vi.fn(() => {
    const result = returns[callIdx] ?? returns[returns.length - 1] ?? []
    callIdx++
    return Promise.resolve(result)
  })
  const sql = Object.assign(
    vi.fn(() => {
      const result = returns[callIdx] ?? returns[returns.length - 1] ?? []
      callIdx++
      return Promise.resolve(result)
    }),
    { unsafe }
  ) as MockSql
  return { sql: asSql(sql) }
}

/**
 * Mock interface for IncomingMessage used in test helpers.
 * Provides the subset of properties that CMS route handlers actually access.
 */
export interface MockIncomingMessage {
  method: string
  url: string
  headers: Record<string, string | undefined>
  socket?: { encrypted?: boolean | undefined; remoteAddress?: string }
  on: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
}

/**
 * Mock interface for ServerResponse used in test helpers.
 * Provides the subset of properties that CMS route handlers actually access.
 */
export interface MockServerResponse {
  writeHead: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  setHeader?: ReturnType<typeof vi.fn>
  getHeader?: ReturnType<typeof vi.fn>
  body: string
  statusCode: number
  setCookie?: string | string[]
}

/** Cast a MockIncomingMessage to IncomingMessage. Single-direction cast for test mocks. */
export function asReq (mock: MockIncomingMessage): IncomingMessage {
  return mock as unknown as IncomingMessage
}

/** Cast a MockServerResponse to ServerResponse (with optional extra fields). */
export function asRes<T extends object = Record<string, never>> (mock: MockServerResponse): ServerResponse & T {
  return mock as unknown as ServerResponse & T
}
