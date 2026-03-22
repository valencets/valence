import { vi } from 'vitest'
import type { DbPool } from '@valencets/db'

export function makeMockPool (returnValue: unknown = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  Object.defineProperty(sql, 'json', { value: (v: unknown) => v })
  Object.defineProperty(sql, 'array', { value: (v: unknown) => v })
  return { sql }
}

export function makeSequentialMockPool (returnValues: Record<string, unknown[]>): DbPool {
  let callIndex = 0
  const keys = Object.keys(returnValues)
  const sql = vi.fn(() => {
    const key = keys[callIndex] ?? keys[keys.length - 1]
    const result = returnValues[key ?? ''] ?? []
    callIndex++
    return Promise.resolve(result)
  }) as unknown as DbPool['sql']
  Object.defineProperty(sql, 'json', { value: (v: unknown) => v })
  Object.defineProperty(sql, 'array', { value: (v: unknown) => v })
  return { sql }
}

export function makeErrorPool (error: Error): DbPool {
  const sql = vi.fn(() => Promise.reject(error)) as unknown as DbPool['sql']
  Object.defineProperty(sql, 'json', { value: (v: unknown) => v })
  Object.defineProperty(sql, 'array', { value: (v: unknown) => v })
  return { sql }
}

/**
 * Returns a pool that resolves successfully for the first N calls (one per entry
 * in `successRows`), then rejects with `error` on all subsequent calls. Useful
 * for testing partial-failure pipelines such as "session creation succeeds,
 * event insertion fails".
 */
export function makeErrorAfterPool (successRows: ReadonlyArray<ReadonlyArray<object>>, error: Error): DbPool {
  let callIndex = 0
  const sql = vi.fn(() => {
    const rows = successRows[callIndex]
    callIndex++
    if (rows !== undefined) return Promise.resolve(rows)
    return Promise.reject(error)
  }) as unknown as DbPool['sql']
  Object.defineProperty(sql, 'json', { value: (v: object) => v })
  Object.defineProperty(sql, 'array', { value: (v: unknown) => v })
  return { sql }
}
