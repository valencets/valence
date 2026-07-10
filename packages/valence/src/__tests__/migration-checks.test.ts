import { describe, it, expect, vi } from 'vitest'
import { validateColumnNaming } from '../migration-checks.js'
import type { DbPool } from '@valencets/db'

// #351 — the column-naming validation used to run AFTER closePool, so every
// query rejected against the closed pool and the warnings were dead code.
// Extracted here so it runs on a live pool and stays testable.

function schemaPool (tables: Record<string, string[]>): DbPool {
  const unsafe = vi.fn(async (text: string, params?: readonly string[]) => {
    if (text.includes('information_schema.tables')) {
      return Object.keys(tables).map(name => ({ table_name: name }))
    }
    if (text.includes('information_schema.columns')) {
      const cols = tables[String(params?.[0])] ?? []
      return cols.map(name => ({ column_name: name }))
    }
    return []
  })
  return { sql: Object.assign(vi.fn(), { unsafe }) } as unknown as DbPool
}

describe('validateColumnNaming', () => {
  it('warns about camelCase system columns with a rename hint', async () => {
    const warnings: string[] = []
    const pool = schemaPool({ posts: ['id', 'createdAt', 'updated_at', 'deleted_at', 'created_at'] })

    await validateColumnNaming(pool, (msg) => { warnings.push(msg) })

    expect(warnings.some(w => w.includes('createdAt') && w.includes('created_at') && w.includes('posts'))).toBe(true)
    expect(warnings.some(w => w.includes('RENAME COLUMN'))).toBe(true)
  })

  it('warns when a CMS-shaped table is missing deleted_at', async () => {
    const warnings: string[] = []
    const pool = schemaPool({ posts: ['id', 'created_at', 'updated_at'] })

    await validateColumnNaming(pool, (msg) => { warnings.push(msg) })

    expect(warnings.some(w => w.includes('deleted_at') && w.includes('posts'))).toBe(true)
  })

  it('stays silent for conforming tables', async () => {
    const warnings: string[] = []
    const pool = schemaPool({ posts: ['id', 'title', 'created_at', 'updated_at', 'deleted_at'] })

    await validateColumnNaming(pool, (msg) => { warnings.push(msg) })

    expect(warnings).toHaveLength(0)
  })

  it('never throws — query failures resolve silently (best-effort check)', async () => {
    const unsafe = vi.fn(async () => Promise.reject(new Error('connection closed')))
    const pool = { sql: Object.assign(vi.fn(), { unsafe }) } as unknown as DbPool

    await expect(validateColumnNaming(pool, () => {})).resolves.toBeUndefined()
  })
})

describe('cli wiring', () => {
  it('runs the validation before the pool closes', async () => {
    const { readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.ts'),
      'utf-8'
    ).replace(/\r\n/g, '\n')

    const fnStart = source.indexOf('async function runMigrationsForProject')
    const fnBody = source.slice(fnStart, source.indexOf('export async function seedDatabase'))
    const validateAt = fnBody.indexOf('validateColumnNaming(')
    const closeAt = fnBody.indexOf('closePool(pool)')

    expect(validateAt).toBeGreaterThan(-1)
    expect(closeAt).toBeGreaterThan(-1)
    expect(validateAt).toBeLessThan(closeAt)
  })
})
