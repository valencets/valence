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
