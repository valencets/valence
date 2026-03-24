import type { DbPool } from './connection.js'

type MockRow = Record<string, string | number | boolean | null>
type RejectedBoundaryPayload = Error | {
  readonly message: string
  readonly code?: string
}

// Shared DB helpers intentionally cover stateless query-path tests only.
// Session-affine behaviors such as reserve()/release() should use local inline mocks.

export function makeMockPool (rows: ReadonlyArray<MockRow> = []): DbPool {
  const unsafe = (): Promise<ReadonlyArray<MockRow>> => Promise.resolve(rows)
  const sql = Object.assign(
    (): Promise<ReadonlyArray<MockRow>> => Promise.resolve(rows),
    { unsafe, begin: (): Promise<void> => Promise.resolve(), array: (v: readonly string[]) => v }
  ) as unknown as DbPool['sql']
  return { sql }
}

export function makeRejectingPool (error: RejectedBoundaryPayload): DbPool {
  const unsafe = (): Promise<never> => Promise.reject(error)
  const sql = Object.assign(
    (): Promise<never> => Promise.reject(error),
    { unsafe, begin: (): Promise<never> => Promise.reject(error), array: (v: readonly string[]) => v }
  ) as unknown as DbPool['sql']
  return { sql }
}

export function makeSequentialPool (returns: ReadonlyArray<ReadonlyArray<MockRow>>): DbPool {
  let callIdx = 0
  const next = (): Promise<ReadonlyArray<MockRow>> => {
    const result = returns[callIdx] ?? returns[returns.length - 1] ?? []
    callIdx++
    return Promise.resolve(result)
  }
  const sql = Object.assign(
    (): Promise<ReadonlyArray<MockRow>> => next(),
    { unsafe: (): Promise<ReadonlyArray<MockRow>> => next(), begin: (): Promise<void> => Promise.resolve(), array: (v: readonly string[]) => v }
  ) as unknown as DbPool['sql']
  return { sql }
}
