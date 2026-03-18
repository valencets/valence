import { vi } from 'vitest'
import type { DbPool } from '@valencets/db'

export function makeMockPool (returnValue: readonly Record<string, string | number | null>[] = []): DbPool {
  const unsafe = vi.fn(() => Promise.resolve(returnValue))
  const sql = Object.assign(
    vi.fn(() => Promise.resolve(returnValue)),
    { unsafe }
  ) as unknown as DbPool['sql']
  return { sql }
}

export function makeErrorPool (error: Error): DbPool {
  const unsafe = vi.fn(() => Promise.reject(error))
  const sql = Object.assign(
    vi.fn(() => Promise.reject(error)),
    { unsafe }
  ) as unknown as DbPool['sql']
  return { sql }
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
  ) as unknown as DbPool['sql']
  return { sql }
}
