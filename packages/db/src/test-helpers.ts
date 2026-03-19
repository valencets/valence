import type { DbPool } from './connection.js'
import type { DbError } from './types.js'

type MockRow = Record<string, string | number | boolean | null>

export function makeMockPool (rows: ReadonlyArray<MockRow> = []): DbPool {
  const unsafe = (): Promise<ReadonlyArray<MockRow>> => Promise.resolve(rows)
  const sql = Object.assign(
    (): Promise<ReadonlyArray<MockRow>> => Promise.resolve(rows),
    { unsafe, begin: (): Promise<void> => Promise.resolve() }
  ) as unknown as DbPool['sql']
  return { sql }
}

export function makeErrorPool (error: DbError): DbPool {
  const unsafe = (): Promise<never> => Promise.reject(error)
  const sql = Object.assign(
    (): Promise<never> => Promise.reject(error),
    { unsafe, begin: (): Promise<never> => Promise.reject(error) }
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
    { unsafe: (): Promise<ReadonlyArray<MockRow>> => next(), begin: (): Promise<void> => Promise.resolve() }
  ) as unknown as DbPool['sql']
  return { sql }
}
