// Testable building blocks for `valence init`. The command must survive
// every stdin it meets — a terminal, a heredoc, CI — and must never claim
// success it didn't earn.

export interface InitFlags {
  readonly useDefaults: boolean
  readonly learnMode: boolean
  readonly noInstall: boolean
  readonly noDb: boolean
  readonly noMigrate: boolean
  readonly noSeed: boolean
  readonly noGit: boolean
}

export function parseInitFlags (args: ReadonlyArray<string>): InitFlags {
  return {
    useDefaults: args.includes('--yes') || args.includes('-y'),
    learnMode: args.includes('--learn'),
    noInstall: args.includes('--no-install'),
    noDb: args.includes('--no-db'),
    noMigrate: args.includes('--no-migrate'),
    noSeed: args.includes('--no-seed'),
    noGit: args.includes('--no-git')
  }
}

interface PromptSource {
  question: (prompt: string) => Promise<string>
  once: (event: string, fn: () => void) => void
}

/**
 * readline/promises rejects pending questions when stdin closes — piped
 * input that runs dry must resolve to the default, not hang or silently
 * exit with half a project scaffolded.
 */
export function askWithDefault (rl: PromptSource, question: string, fallback: string): Promise<string> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (value: string): void => {
      if (settled) return
      settled = true
      resolve(value)
    }
    rl.once('close', () => { settle(fallback) })
    rl.question(`  ${question} (${fallback}): `).then(
      (answer) => { settle(answer.trim() === '' ? fallback : answer.trim()) },
      () => { settle(fallback) }
    )
  })
}

export async function confirmWithDefault (rl: PromptSource, question: string, defaultYes: boolean): Promise<boolean> {
  const hint = defaultYes ? 'Y/n' : 'y/N'
  const answer = await askWithDefault(rl, `${question} (${hint})`, defaultYes ? 'y' : 'n')
  const normalized = answer.trim().toLowerCase()
  if (normalized === '') return defaultYes
  return normalized === 'y' || normalized === 'yes'
}

export interface DbConnectionAnswers {
  readonly dbName: string
  readonly dbHost: string
  readonly dbPort: string
  readonly dbUser: string
  readonly dbPassword: string
}

export interface CommandInvocation {
  readonly command: string
  readonly env: Readonly<{ [key: string]: string }>
}

/**
 * `valence dev` works on `<name>_dev` and `valence start` on `<name>` —
 * init creates both so neither command's first run trips over a missing
 * database. Connection details come from the answers, not from whatever
 * OS user happens to be running init.
 */
export function createDbInvocations (answers: DbConnectionAnswers): readonly CommandInvocation[] {
  const flags = `-h ${answers.dbHost} -p ${answers.dbPort} -U ${answers.dbUser}`
  const env = Object.freeze({ PGPASSWORD: answers.dbPassword })
  return [
    { command: `createdb ${flags} ${answers.dbName}`, env },
    { command: `createdb ${flags} ${answers.dbName}_dev`, env }
  ]
}

export interface MigrationTarget {
  readonly host: string
  readonly port: number
  readonly database: string
  readonly username: string
  readonly password: string
  readonly max: number
  readonly idle_timeout: number
  readonly connect_timeout: number
}

export function migrationTargets (answers: DbConnectionAnswers): readonly MigrationTarget[] {
  const base = {
    host: answers.dbHost,
    port: Number(answers.dbPort),
    username: answers.dbUser,
    password: answers.dbPassword,
    max: 5,
    idle_timeout: 10,
    connect_timeout: 10
  }
  return [
    { ...base, database: answers.dbName },
    { ...base, database: `${answers.dbName}_dev` }
  ]
}

/** The closing message earns its optimism: any failed step turns it into
 *  an honest checklist instead of "your project is ready". */
export function initSummary (projectName: string, serverPort: number | string, failures: readonly string[], learnMode: boolean): string {
  const learnUrl = learnMode ? `\n  Tutorial: http://localhost:${serverPort}/_learn` : ''
  if (failures.length === 0) {
    return `
  Done. Your project is ready.

    cd ${projectName}
    pnpm dev

  Site:  http://localhost:${serverPort}
  Admin: http://localhost:${serverPort}/admin${learnUrl}
`
  }
  const list = failures.map(f => `    - ${f}`).join('\n')
  return `
  Scaffolding finished, but some steps failed:

${list}

  Fix these before running the project:

    cd ${projectName}
    pnpm dev

  Site:  http://localhost:${serverPort}
  Admin: http://localhost:${serverPort}/admin${learnUrl}
`
}

interface LineSource {
  on (event: 'line', fn: (line: string) => void): unknown
  on (event: 'close', fn: () => void): unknown
}

export interface PromptQueue {
  question (prompt: string): Promise<string>
  once (event: string, fn: () => void): void
}

/**
 * readline consumes piped stdin instantly and fires 'close' before later
 * questions ever run — buffered lines would be lost and every remaining
 * prompt would fall back to its default. This queue owns the lines:
 * buffered input answers questions in order regardless of when EOF
 * arrived; a dry buffer after close rejects so askWithDefault falls back.
 */
export function createPromptQueue (input: LineSource, write: (prompt: string) => void): PromptQueue {
  const lines: string[] = []
  const waiters: Array<{ resolve: (value: string) => void; reject: (cause: Error) => void }> = []
  const closeCallbacks: Array<() => void> = []
  let closed = false

  input.on('line', (line: string) => {
    const waiter = waiters.shift()
    if (waiter !== undefined) waiter.resolve(line)
    else lines.push(line)
  })

  input.on('close', () => {
    closed = true
    for (const waiter of waiters.splice(0)) waiter.reject(new Error('input closed'))
    for (const callback of closeCallbacks.splice(0)) callback()
  })

  return {
    question (prompt: string): Promise<string> {
      write(prompt)
      const buffered = lines.shift()
      if (buffered !== undefined) return Promise.resolve(buffered)
      if (closed) return Promise.reject(new Error('input closed'))
      return new Promise((resolve, reject) => { waiters.push({ resolve, reject }) })
    },
    once (event: string, fn: () => void): void {
      if (event !== 'close' || closed) return
      closeCallbacks.push(fn)
    }
  }
}

const PLATFORM_PACKAGES = [
  '@valencets/cms',
  '@valencets/db',
  '@valencets/store',
  '@valencets/reactive',
  '@valencets/ui',
  '@valencets/resultkit'
] as const

/**
 * Scaffolded projects install the whole platform, pinned to the versions
 * this CLI shipped with. The published package.json carries exact sibling
 * versions (pnpm rewrites workspace links at publish), so the pins come
 * from our own dependency map; unrewritten workspace links only occur in
 * monorepo development, where `latest` is a harmless placeholder.
 */
export function scaffoldDependencies (
  cliVersion: string,
  ownDependencies: Readonly<{ [name: string]: string }>
): { [name: string]: string } {
  const pin = (declared: string | undefined): string => {
    if (declared === undefined || declared.startsWith('workspace')) return 'latest'
    if (declared.startsWith('^') || declared.startsWith('~')) return declared
    return `^${declared}`
  }

  const deps: { [name: string]: string } = {
    '@valencets/valence': `^${cliVersion}`
  }
  for (const name of PLATFORM_PACKAGES) {
    deps[name] = pin(ownDependencies[name])
  }
  deps.tsx = pin(ownDependencies.tsx)
  return deps
}
