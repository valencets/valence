import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { ResultAsync, fromThrowable } from 'neverthrow'
import { join } from 'node:path'
import type { LearnProgress, LearnStepId } from './types.js'

const LEARN_DIR = '.valence'
const LEARN_FILE = 'learn.json'

const ALL_STEP_IDS: ReadonlyArray<LearnStepId> = [
  'visit-admin',
  'create-post',
  'hit-api',
  'add-collection',
  'create-user',
  'create-file'
]

export async function ensureLearnDir (projectDir: string): Promise<void> {
  await mkdir(join(projectDir, LEARN_DIR), { recursive: true })
}

export function createInitialProgress (initialCounts: { readonly posts: number; readonly users: number }): LearnProgress {
  const steps = {} as Record<LearnStepId, { completed: boolean; completedAt: null }>
  for (const id of ALL_STEP_IDS) {
    steps[id] = { completed: false, completedAt: null }
  }

  return {
    enabled: true,
    startedAt: new Date().toISOString(),
    steps,
    initialCounts
  }
}

const safeJsonParseProgress = fromThrowable(
  (raw: string) => JSON.parse(raw) as LearnProgress,
  () => null
)

export async function readLearnProgress (projectDir: string): Promise<LearnProgress | null> {
  const result = await ResultAsync.fromPromise(
    readFile(join(projectDir, LEARN_DIR, LEARN_FILE), 'utf-8'),
    () => null
  )
  if (result.isErr()) return null
  const parseResult = safeJsonParseProgress(result.value)
  return parseResult.isOk() ? parseResult.value : null
}

export async function writeLearnProgress (projectDir: string, progress: LearnProgress): Promise<void> {
  await writeFile(
    join(projectDir, LEARN_DIR, LEARN_FILE),
    JSON.stringify(progress, null, 2) + '\n'
  )
}
