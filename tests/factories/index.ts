import { collection, field } from '@valencets/cms'
import type { CollectionConfig } from '@valencets/cms'

let counter = 0

function nextId (): number {
  return ++counter
}

export function resetFactoryCounter (): void {
  counter = 0
}

export function buildUserData (overrides: Partial<{ email: string; password: string; name: string }> = {}): {
  email: string
  password: string
  name: string
} {
  const id = nextId()
  return {
    email: overrides.email ?? `user${id}@test.local`,
    password: overrides.password ?? `TestPassword${id}!`,
    name: overrides.name ?? `Test User ${id}`
  }
}

export function buildPostData (overrides: Partial<{ title: string; slug: string; content: string; status: string }> = {}): {
  title: string
  slug: string
  content: string
  status: string
} {
  const id = nextId()
  return {
    title: overrides.title ?? `Test Post ${id}`,
    slug: overrides.slug ?? `test-post-${id}`,
    content: overrides.content ?? `Content for post ${id}`,
    status: overrides.status ?? 'draft'
  }
}

export function buildCollectionConfig (overrides: Partial<CollectionConfig> = {}): CollectionConfig {
  const id = nextId()
  return collection({
    slug: overrides.slug ?? `test-collection-${id}`,
    labels: overrides.labels ?? { singular: `Item ${id}`, plural: `Items ${id}` },
    fields: overrides.fields ?? [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', from: 'title' }),
      field.textarea({ name: 'body' })
    ],
    ...overrides
  })
}

export function buildMediaData (overrides: Partial<{ filename: string; mimeType: string; size: number }> = {}): {
  filename: string
  mimeType: string
  size: number
} {
  const id = nextId()
  return {
    filename: overrides.filename ?? `test-file-${id}.png`,
    mimeType: overrides.mimeType ?? 'image/png',
    size: overrides.size ?? 1024 * id
  }
}
