import { describe, it, expect } from 'vitest'
import { run } from '../cli.js'

describe('CLI', () => {
  it('prints usage when no command given', async () => {
    const logs: string[] = []
    const originalLog = console.log
    console.log = (msg: string) => { logs.push(msg) }
    await run([])
    console.log = originalLog
    expect(logs.some((l) => l.includes('Usage:'))).toBe(true)
  })

  it('prints usage for unknown command', async () => {
    const logs: string[] = []
    const originalLog = console.log
    console.log = (msg: string) => { logs.push(msg) }
    await run(['nonexistent'])
    console.log = originalLog
    expect(logs.some((l) => l.includes('Usage:'))).toBe(true)
  })

  it('lists all four commands', async () => {
    const logs: string[] = []
    const originalLog = console.log
    console.log = (msg: string) => { logs.push(msg) }
    await run([])
    console.log = originalLog
    const output = logs.join('\n')
    expect(output).toContain('init')
    expect(output).toContain('dev')
    expect(output).toContain('migrate')
    expect(output).toContain('build')
  })
})

describe('CLI security', () => {
  it('does not use execSync with string concatenation for tsx script execution', async () => {
    const { readFileSync } = await import('node:fs')
    const cliSource = readFileSync(new URL('../cli.ts', import.meta.url).pathname.replace('/dist/', '/src/'), 'utf-8')
    const loaderSource = readFileSync(new URL('../config-loader.ts', import.meta.url).pathname.replace('/dist/', '/src/'), 'utf-8')
    // Should use execFileSync (array args, no shell) instead of execSync with template literal
    expect(cliSource).not.toMatch(/execSync\s*\(\s*`/)
    expect(loaderSource).not.toMatch(/execSync\s*\(\s*`/)
    expect(loaderSource).toMatch(/execFileSync/)
  })
})

describe('seed data', () => {
  it('exports a seedDatabase function', async () => {
    const { seedDatabase } = await import('../cli.js')
    expect(typeof seedDatabase).toBe('function')
  })

  it('seedDatabase inserts category, post, and page', async () => {
    const { seedDatabase } = await import('../cli.js')
    const queries: Array<{ text: string; values: readonly (string | boolean | null)[] }> = []
    const mockPool = {
      sql: {
        unsafe: async (text: string, values: readonly (string | boolean | null)[] = []) => {
          queries.push({ text, values })
          if (text.includes('SELECT id FROM')) {
            return [{ id: 'cat-uuid-123' }]
          }
          return []
        }
      }
    }
    await seedDatabase(mockPool as Parameters<typeof seedDatabase>[0])
    const allSql = queries.map(q => q.text).join('\n')
    expect(allSql).toContain('INSERT INTO "categories"')
    expect(allSql).toContain('INSERT INTO "posts"')
    expect(allSql).toContain('INSERT INTO "pages"')
    const allValues = queries.flatMap(q => q.values).join('\n')
    expect(allValues).toContain('Welcome to Valence')
  })
})
