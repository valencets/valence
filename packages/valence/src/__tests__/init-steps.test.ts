import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import {
  parseInitFlags,
  askWithDefault,
  confirmWithDefault,
  createDbInvocations,
  migrationTargets,
  initSummary
} from '../init-steps.js'

interface FakeReadline {
  question: (prompt: string) => Promise<string>
  once: (event: string, fn: () => void) => void
  emitClose: () => void
}

function fakeRl (answers: readonly string[]): FakeReadline {
  const emitter = new EventEmitter()
  const queue = [...answers]
  return {
    question: async () => {
      const next = queue.shift()
      if (next === undefined) {
        // Piped stdin ran dry: readline/promises rejects pending questions
        emitter.emit('close')
        return await new Promise<never>((_resolve, reject) => { reject(new Error('closed')) })
      }
      return next
    },
    once: (event, fn) => { emitter.once(event, fn) },
    emitClose: () => { emitter.emit('close') }
  }
}

describe('parseInitFlags', () => {
  it('supports granular skips alongside --yes', () => {
    const flags = parseInitFlags(['my-app', '--yes', '--no-install', '--no-git'])
    expect(flags.useDefaults).toBe(true)
    expect(flags.noInstall).toBe(true)
    expect(flags.noGit).toBe(true)
    expect(flags.noDb).toBe(false)
    expect(flags.noSeed).toBe(false)
  })

  it('recognizes --no-db, --no-migrate and --no-seed', () => {
    const flags = parseInitFlags(['--no-db', '--no-migrate', '--no-seed'])
    expect(flags.noDb).toBe(true)
    expect(flags.noMigrate).toBe(true)
    expect(flags.noSeed).toBe(true)
    expect(flags.useDefaults).toBe(false)
  })
})

describe('EOF-safe prompts', () => {
  it('answers normally while stdin has lines', async () => {
    const rl = fakeRl(['custom-name'])
    const answer = await askWithDefault(rl, 'Project name', 'fallback')
    expect(answer).toBe('custom-name')
  })

  it('falls back to the default when piped stdin runs dry instead of hanging or dying', async () => {
    const rl = fakeRl([])
    const answer = await askWithDefault(rl, 'Project name', 'fallback')
    expect(answer).toBe('fallback')
  })

  it('confirm falls back to its default on EOF', async () => {
    const rl = fakeRl([])
    expect(await confirmWithDefault(rl, 'Install dependencies?', true)).toBe(true)
    expect(await confirmWithDefault(rl, 'Risky thing?', false)).toBe(false)
  })

  it('blank answers keep defaults, y/n answers parse', async () => {
    const rl = fakeRl(['', 'n'])
    expect(await confirmWithDefault(rl, 'Install dependencies?', true)).toBe(true)
    expect(await confirmWithDefault(rl, 'Initialize git?', true)).toBe(false)
  })
})

describe('createDbInvocations', () => {
  it('creates the project database and its _dev sibling with full connection flags', () => {
    const invocations = createDbInvocations({
      dbName: 'shop', dbHost: 'db.internal', dbPort: '5433', dbUser: 'app', dbPassword: 'sekret'
    })

    expect(invocations).toHaveLength(2)
    expect(invocations[0]!.file).toBe('createdb')
    expect(invocations[0]!.args).toEqual(['-h', 'db.internal', '-p', '5433', '-U', 'app', 'shop'])
    expect(invocations[1]!.args).toEqual(['-h', 'db.internal', '-p', '5433', '-U', 'app', 'shop_dev'])
    for (const invocation of invocations) {
      expect(invocation.env.PGPASSWORD).toBe('sekret')
    }
  })

  it('passes hostile answers as argv entries, never through a shell', () => {
    const invocations = createDbInvocations({
      dbName: 'x; rm -rf /', dbHost: '$(whoami)', dbPort: '5432', dbUser: 'a b', dbPassword: 'p'
    })

    // Argv arrays reach execFile verbatim — nothing is ever interpolated
    // into a shell string, so metacharacters are inert data.
    expect(invocations[0]!.args).toContain('x; rm -rf /')
    expect(invocations[0]!.args).toContain('$(whoami)')
    const flattened = [invocations[0]!.file, ...invocations[0]!.args].join(' ')
    expect(invocations[0]!).not.toHaveProperty('command')
    expect(flattened).toContain('$(whoami)')
  })
})

describe('migrationTargets', () => {
  it('migrates both the base database and the _dev database valence dev uses', () => {
    const targets = migrationTargets({
      dbName: 'shop', dbHost: 'localhost', dbPort: '5432', dbUser: 'postgres', dbPassword: 'postgres'
    })

    expect(targets.map(t => t.database)).toEqual(['shop', 'shop_dev'])
    expect(targets[0]!.host).toBe('localhost')
    expect(targets[0]!.port).toBe(5432)
  })
})

describe('initSummary', () => {
  it('celebrates only when every step succeeded', () => {
    const summary = initSummary('my-app', 3000, [], false)
    expect(summary).toContain('Done. Your project is ready.')
  })

  it('reports failures honestly instead of claiming success', () => {
    const summary = initSummary('my-app', 3000, ['database creation failed', 'migrations failed'], false)
    expect(summary).not.toContain('Your project is ready')
    expect(summary).toContain('database creation failed')
    expect(summary).toContain('migrations failed')
  })
})

describe('createPromptQueue', () => {
  it('serves buffered piped lines even after the input stream closes', async () => {
    const { createPromptQueue } = await import('../init-steps.js')
    const input = new EventEmitter()
    const queue = createPromptQueue(input, () => {})

    // Piped stdin delivers everything instantly, then EOF
    input.emit('line', 'first')
    input.emit('line', 'second')
    input.emit('close')

    expect(await queue.question('A?')).toBe('first')
    expect(await queue.question('B?')).toBe('second')
  })

  it('falls back to rejection semantics when the buffer runs dry after close', async () => {
    const { createPromptQueue } = await import('../init-steps.js')
    const input = new EventEmitter()
    const queue = createPromptQueue(input, () => {})

    input.emit('line', 'only-one')
    input.emit('close')

    expect(await queue.question('A?')).toBe('only-one')
    const dry = await askWithDefault(queue, 'B', 'fallback')
    expect(dry).toBe('fallback')
  })

  it('waits for lines that have not arrived yet (interactive mode)', async () => {
    const { createPromptQueue } = await import('../init-steps.js')
    const input = new EventEmitter()
    const queue = createPromptQueue(input, () => {})

    const pending = queue.question('A?')
    input.emit('line', 'typed-later')
    expect(await pending).toBe('typed-later')
  })
})

describe('scaffoldDependencies', () => {
  it('installs the full platform pinned to the released versions', async () => {
    const { scaffoldDependencies } = await import('../init-steps.js')
    const deps = scaffoldDependencies('0.18.0', {
      '@valencets/cms': '0.13.0',
      '@valencets/core': '0.6.0',
      '@valencets/db': '0.3.0',
      '@valencets/store': '0.2.0',
      '@valencets/reactive': '0.3.0',
      '@valencets/ui': '0.4.0',
      '@valencets/resultkit': '^0.5.0',
      tsx: '^4.21.0'
    })

    expect(deps['@valencets/valence']).toBe('^0.18.0')
    expect(deps['@valencets/cms']).toBe('^0.13.0')
    expect(deps['@valencets/db']).toBe('^0.3.0')
    expect(deps['@valencets/store']).toBe('^0.2.0')
    expect(deps['@valencets/reactive']).toBe('^0.3.0')
    expect(deps['@valencets/ui']).toBe('^0.4.0')
    expect(deps['@valencets/resultkit']).toBe('^0.5.0')
    expect(deps.tsx).toBe('^4.21.0')
    expect(Object.values(deps)).not.toContain('latest')
  })

  it('falls back to latest only for unrewritten workspace links (monorepo dev)', async () => {
    const { scaffoldDependencies } = await import('../init-steps.js')
    const deps = scaffoldDependencies('0.18.0', {
      '@valencets/cms': 'workspace:*',
      '@valencets/store': 'workspace:*'
    })

    expect(deps['@valencets/cms']).toBe('latest')
    expect(deps['@valencets/store']).toBe('latest')
    expect(deps['@valencets/valence']).toBe('^0.18.0')
  })
})
