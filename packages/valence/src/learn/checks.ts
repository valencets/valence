import { readdirSync } from 'node:fs'
import type { Dirent } from 'node:fs'
import { fromThrowable, ResultAsync } from '@valencets/resultkit'
import type { LearnCheckDeps, LearnProgress, LearnStepId } from './types.js'

const DEFAULT_SLUGS: ReadonlySet<string> = new Set(['categories', 'posts', 'pages', 'users'])
const IGNORED_ROOT_FILES: ReadonlySet<string> = new Set(['valence.config.ts', 'tsconfig.json'])

const safeReaddirSync = fromThrowable(
  (dir: string): Dirent[] => readdirSync(dir, { withFileTypes: true }),
  () => null
)

export async function checkVisitAdmin (deps: LearnCheckDeps): Promise<boolean> {
  return deps.signals.adminPageViews > 0
}

export async function checkCreatePost (deps: LearnCheckDeps, initialCount: number): Promise<boolean> {
  const result = await ResultAsync.fromPromise(
    deps.pool.sql.unsafe('SELECT count(*)::int AS count FROM "posts" WHERE "deleted_at" IS NULL'),
    () => null
  )
  if (result.isErr() || result.value === null) return false
  const count = Number((result.value as Array<{ count?: number }>)[0]?.count ?? 0)
  return count > initialCount
}

export async function checkHitApi (deps: LearnCheckDeps): Promise<boolean> {
  return deps.signals.apiGetRequests > 0
}

export async function checkAddCollection (deps: LearnCheckDeps): Promise<boolean> {
  if (!deps.signals.configChangeDetected) return false
  return deps.configSlugs.some(slug => !DEFAULT_SLUGS.has(slug))
}

export async function checkCreateUser (deps: LearnCheckDeps, initialCount: number): Promise<boolean> {
  const result = await ResultAsync.fromPromise(
    deps.pool.sql.unsafe('SELECT count(*)::int AS count FROM "users" WHERE "deleted_at" IS NULL'),
    () => null
  )
  if (result.isErr() || result.value === null) return false
  const count = Number((result.value as Array<{ count?: number }>)[0]?.count ?? 0)
  return count > initialCount
}

export async function checkCreateFile (deps: LearnCheckDeps): Promise<boolean> {
  const result = safeReaddirSync(deps.projectDir)
  if (result.isErr() || result.value === null) return false
  return result.value.some(e =>
    e.isFile() &&
    e.name.endsWith('.ts') &&
    !IGNORED_ROOT_FILES.has(e.name)
  )
}

type StepChecker = (deps: LearnCheckDeps, initialCount: number) => Promise<boolean>

const STEP_CHECKERS: ReadonlyArray<{ id: LearnStepId; check: StepChecker; countKey: 'posts' | 'users' | null }> = [
  { id: 'visit-admin', check: (deps) => checkVisitAdmin(deps), countKey: null },
  { id: 'create-post', check: (deps, n) => checkCreatePost(deps, n), countKey: 'posts' },
  { id: 'hit-api', check: (deps) => checkHitApi(deps), countKey: null },
  { id: 'add-collection', check: (deps) => checkAddCollection(deps), countKey: null },
  { id: 'create-user', check: (deps, n) => checkCreateUser(deps, n), countKey: 'users' },
  { id: 'create-file', check: (deps) => checkCreateFile(deps), countKey: null }
]

export async function checkAllSteps (progress: LearnProgress, deps: LearnCheckDeps): Promise<LearnProgress> {
  const updatedSteps = { ...progress.steps }

  for (const { id, check, countKey } of STEP_CHECKERS) {
    if (updatedSteps[id].completed) continue

    const initialCount = countKey !== null ? progress.initialCounts[countKey] : 0
    const passed = await check(deps, initialCount)

    if (passed) {
      updatedSteps[id] = { completed: true, completedAt: new Date().toISOString() }
    }
  }

  return { ...progress, steps: updatedSteps }
}
