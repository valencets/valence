import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import {
  checkVisitAdmin,
  checkCreatePost,
  checkHitApi,
  checkAddCollection,
  checkCreateUser,
  checkCreateFile,
  checkAllSteps
} from '../checks.js'
import { createLearnSignals } from '../signals.js'
import { createInitialProgress } from '../state.js'
import type { LearnCheckDeps } from '../types.js'

function makeMockPool (counts: { posts?: number; users?: number } = {}) {
  return {
    query: async (text: string) => {
      if (text.includes('"posts"')) {
        return { rows: [{ count: String(counts.posts ?? 0) }] }
      }
      if (text.includes('"users"')) {
        return { rows: [{ count: String(counts.users ?? 0) }] }
      }
      return { rows: [] }
    }
  }
}

function makeDeps (overrides: Partial<LearnCheckDeps> = {}): LearnCheckDeps {
  return {
    pool: makeMockPool(),
    signals: createLearnSignals(),
    configSlugs: ['categories', 'posts', 'pages', 'users'],
    projectDir: '/tmp/nonexistent',
    ...overrides
  }
}

// -- checkVisitAdmin --

describe('checkVisitAdmin', () => {
  it('returns false when no admin views', async () => {
    const deps = makeDeps()
    expect(await checkVisitAdmin(deps)).toBe(false)
  })

  it('returns true when admin views > 0', async () => {
    const signals = createLearnSignals()
    signals.adminPageViews = 1
    expect(await checkVisitAdmin(makeDeps({ signals }))).toBe(true)
  })
})

// -- checkCreatePost --

describe('checkCreatePost', () => {
  it('returns false when post count equals initial', async () => {
    const pool = makeMockPool({ posts: 1 })
    const deps = makeDeps({ pool })
    // initialCounts.posts = 1 by default in progress, but we check via deps
    expect(await checkCreatePost(deps, 1)).toBe(false)
  })

  it('returns true when post count exceeds initial', async () => {
    const pool = makeMockPool({ posts: 3 })
    const deps = makeDeps({ pool })
    expect(await checkCreatePost(deps, 1)).toBe(true)
  })

  it('returns false when DB query fails', async () => {
    const pool = {
      query: async () => { throw new Error('connection refused') }
    }
    const deps = makeDeps({ pool })
    expect(await checkCreatePost(deps, 1)).toBe(false)
  })
})

// -- checkHitApi --

describe('checkHitApi', () => {
  it('returns false when no API requests', async () => {
    expect(await checkHitApi(makeDeps())).toBe(false)
  })

  it('returns true when apiGetRequests > 0', async () => {
    const signals = createLearnSignals()
    signals.apiGetRequests = 5
    expect(await checkHitApi(makeDeps({ signals }))).toBe(true)
  })
})

// -- checkAddCollection --

describe('checkAddCollection', () => {
  it('returns false when config has not changed', async () => {
    expect(await checkAddCollection(makeDeps())).toBe(false)
  })

  it('returns false when config changed but no new slug', async () => {
    const signals = createLearnSignals()
    signals.configChangeDetected = true
    expect(await checkAddCollection(makeDeps({ signals }))).toBe(false)
  })

  it('returns true when config changed and has new slug', async () => {
    const signals = createLearnSignals()
    signals.configChangeDetected = true
    const configSlugs = ['categories', 'posts', 'pages', 'users', 'tags']
    expect(await checkAddCollection(makeDeps({ signals, configSlugs }))).toBe(true)
  })
})

// -- checkCreateUser --

describe('checkCreateUser', () => {
  it('returns false when user count equals initial', async () => {
    const pool = makeMockPool({ users: 0 })
    expect(await checkCreateUser(makeDeps({ pool }), 0)).toBe(false)
  })

  it('returns true when user count exceeds initial', async () => {
    const pool = makeMockPool({ users: 2 })
    expect(await checkCreateUser(makeDeps({ pool }), 0)).toBe(true)
  })

  it('returns false when DB query fails', async () => {
    const pool = {
      query: async () => { throw new Error('connection refused') }
    }
    expect(await checkCreateUser(makeDeps({ pool }), 0)).toBe(false)
  })
})

// -- checkCreateFile --

describe('checkCreateFile', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'valence-learn-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns false when no .ts files exist', async () => {
    expect(await checkCreateFile(makeDeps({ projectDir: dir }))).toBe(false)
  })

  it('returns false when only valence.config.ts exists', async () => {
    await writeFile(join(dir, 'valence.config.ts'), 'export default {}')
    expect(await checkCreateFile(makeDeps({ projectDir: dir }))).toBe(false)
  })

  it('returns false when only tsconfig.json exists', async () => {
    await writeFile(join(dir, 'tsconfig.json'), '{}')
    expect(await checkCreateFile(makeDeps({ projectDir: dir }))).toBe(false)
  })

  it('returns true when a custom .ts file exists', async () => {
    await writeFile(join(dir, 'hello.ts'), 'console.log("hi")')
    expect(await checkCreateFile(makeDeps({ projectDir: dir }))).toBe(true)
  })

  it('ignores .ts files in subdirectories (only checks root)', async () => {
    await mkdir(join(dir, 'src'), { recursive: true })
    await writeFile(join(dir, 'src', 'deep.ts'), 'export {}')
    expect(await checkCreateFile(makeDeps({ projectDir: dir }))).toBe(false)
  })
})

// -- checkAllSteps --

describe('checkAllSteps', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'valence-learn-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns progress with no steps completed when nothing happened', async () => {
    const progress = createInitialProgress({ posts: 1, users: 0 })
    const deps = makeDeps({ projectDir: dir, pool: makeMockPool({ posts: 1, users: 0 }) })
    const result = await checkAllSteps(progress, deps)
    for (const step of Object.values(result.steps)) {
      expect(step.completed).toBe(false)
    }
  })

  it('marks visit-admin as completed when signal is set', async () => {
    const progress = createInitialProgress({ posts: 1, users: 0 })
    const signals = createLearnSignals()
    signals.adminPageViews = 1
    const deps = makeDeps({ signals, projectDir: dir, pool: makeMockPool({ posts: 1, users: 0 }) })
    const result = await checkAllSteps(progress, deps)
    expect(result.steps['visit-admin'].completed).toBe(true)
    expect(result.steps['visit-admin'].completedAt).not.toBeNull()
  })

  it('preserves already-completed steps', async () => {
    const now = new Date().toISOString()
    const progress: ReturnType<typeof createInitialProgress> = {
      ...createInitialProgress({ posts: 1, users: 0 }),
      steps: {
        ...createInitialProgress({ posts: 1, users: 0 }).steps,
        'visit-admin': { completed: true, completedAt: now }
      }
    }
    const deps = makeDeps({ projectDir: dir, pool: makeMockPool({ posts: 1, users: 0 }) })
    const result = await checkAllSteps(progress, deps)
    expect(result.steps['visit-admin'].completed).toBe(true)
    expect(result.steps['visit-admin'].completedAt).toBe(now)
  })

  it('marks multiple steps completed simultaneously', async () => {
    const progress = createInitialProgress({ posts: 1, users: 0 })
    const signals = createLearnSignals()
    signals.adminPageViews = 1
    signals.apiGetRequests = 3
    const pool = makeMockPool({ posts: 5, users: 2 })
    const deps = makeDeps({ signals, projectDir: dir, pool })
    const result = await checkAllSteps(progress, deps)
    expect(result.steps['visit-admin'].completed).toBe(true)
    expect(result.steps['hit-api'].completed).toBe(true)
    expect(result.steps['create-post'].completed).toBe(true)
    expect(result.steps['create-user'].completed).toBe(true)
  })
})
