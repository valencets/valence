import { describe, it, expect } from 'vitest'
import { planBoot } from '../boot-plan.js'

// The optional-everything contract: a Valence app is routes + pages by
// default. CMS, admin, database, telemetry, GraphQL, and stores are each
// opt-in — the boot plan derives what to mount and WHY a database is
// needed (so refusals can name the feature that demanded it).

describe('planBoot — minimal app', () => {
  it('an empty config mounts nothing and needs nothing', () => {
    const plan = planBoot({ collections: [] })

    expect(plan.mountCms).toBe(false)
    expect(plan.mountAdmin).toBe(false)
    expect(plan.mountGraphql).toBe(false)
    expect(plan.mountTelemetry).toBe(false)
    expect(plan.registerStores).toBe(false)
    expect(plan.needsDatabase).toBe(false)
    expect(plan.databaseReasons).toEqual([])
    expect(plan.requiresSecret).toBe(false)
  })

  it('routes-only apps need no database and no secret', () => {
    const plan = planBoot({ collections: [], routes: [{ path: '/hello' }] })

    expect(plan.needsDatabase).toBe(false)
    expect(plan.requiresSecret).toBe(false)
  })
})

describe('planBoot — CMS', () => {
  it('collections mount the CMS and demand a database', () => {
    const plan = planBoot({ collections: [{ slug: 'posts' }] })

    expect(plan.mountCms).toBe(true)
    expect(plan.needsDatabase).toBe(true)
    expect(plan.databaseReasons).toContain('collections')
    expect(plan.requiresSecret).toBe(true)
  })

  it('the admin panel mounts only when the admin section is present', () => {
    const headless = planBoot({ collections: [{ slug: 'posts' }] })
    expect(headless.mountAdmin).toBe(false)

    const withAdmin = planBoot({ collections: [{ slug: 'posts' }], admin: { requireAuth: true } })
    expect(withAdmin.mountAdmin).toBe(true)
  })

  it('an admin section without collections mounts no admin', () => {
    const plan = planBoot({ collections: [], admin: { requireAuth: true } })
    expect(plan.mountAdmin).toBe(false)
  })

  it('graphql mounts only alongside the CMS', () => {
    expect(planBoot({ collections: [{ slug: 'posts' }], graphql: true }).mountGraphql).toBe(true)
    expect(planBoot({ collections: [], graphql: true }).mountGraphql).toBe(false)
    expect(planBoot({ collections: [{ slug: 'posts' }] }).mountGraphql).toBe(false)
  })
})

describe('planBoot — telemetry', () => {
  it('enabled telemetry demands a database', () => {
    const plan = planBoot({ collections: [], telemetry: { enabled: true } })

    expect(plan.mountTelemetry).toBe(true)
    expect(plan.needsDatabase).toBe(true)
    expect(plan.databaseReasons).toContain('telemetry')
  })

  it('disabled telemetry demands nothing', () => {
    const plan = planBoot({ collections: [], telemetry: { enabled: false } })

    expect(plan.mountTelemetry).toBe(false)
    expect(plan.needsDatabase).toBe(false)
  })
})

describe('planBoot — stores', () => {
  it('in-memory stores need no database but do need the signing secret', () => {
    const plan = planBoot({ collections: [], stores: [{ slug: 'cart', scope: 'session' }] })

    expect(plan.registerStores).toBe(true)
    expect(plan.needsDatabase).toBe(false)
    expect(plan.requiresSecret).toBe(true)
  })

  it('page-scoped stores need neither database nor secret', () => {
    const plan = planBoot({ collections: [], stores: [{ slug: 'ui', scope: 'page' }] })

    expect(plan.registerStores).toBe(true)
    expect(plan.needsDatabase).toBe(false)
    expect(plan.requiresSecret).toBe(false)
  })

  it('persisted and user-scoped stores demand a database', () => {
    const persisted = planBoot({ collections: [], stores: [{ slug: 'drafts', scope: 'session', persist: true }] })
    expect(persisted.needsDatabase).toBe(true)
    expect(persisted.databaseReasons).toContain('persisted stores')

    const userScoped = planBoot({ collections: [], stores: [{ slug: 'prefs', scope: 'user' }] })
    expect(userScoped.needsDatabase).toBe(true)
    expect(userScoped.databaseReasons).toContain('persisted stores')
  })
})

describe('planBoot — combined reasons', () => {
  it('names every feature that demanded the database', () => {
    const plan = planBoot({
      collections: [{ slug: 'posts' }],
      telemetry: { enabled: true },
      stores: [{ slug: 'prefs', scope: 'user' }]
    })

    expect(plan.needsDatabase).toBe(true)
    expect(plan.databaseReasons).toEqual(['collections', 'telemetry', 'persisted stores'])
  })
})
