// Entity Store — lightweight pub/sub state store keyed by entity ID.
// Enables cross-component sync: when the same entity appears in multiple
// places on a page, mutating one updates all subscribers.

export type EntityData = Record<string, string | number | boolean | null>

type EntityCallback = (entity: EntityData) => void

interface EntityEntry {
  readonly subscribers: Set<EntityCallback>
  state: EntityData
}

export interface EntityStore {
  readonly name: string
  subscribe (id: string, callback: EntityCallback): () => void
  patch (id: string, partial: EntityData): void
  set (id: string, data: EntityData): void
  get (id: string): EntityData | undefined
}

function getOrCreateEntry (entries: Map<string, EntityEntry>, id: string): EntityEntry {
  const existing = entries.get(id)
  if (existing !== undefined) return existing
  const entry: EntityEntry = { subscribers: new Set(), state: {} }
  entries.set(id, entry)
  return entry
}

function notifySubscribers (entry: EntityEntry): void {
  for (const cb of entry.subscribers) {
    cb(entry.state)
  }
}

export function createEntityStore (name: string): EntityStore {
  const entries = new Map<string, EntityEntry>()

  return {
    name,

    subscribe (id: string, callback: EntityCallback): () => void {
      const entry = getOrCreateEntry(entries, id)
      entry.subscribers.add(callback)
      return () => {
        entry.subscribers.delete(callback)
      }
    },

    patch (id: string, partial: EntityData): void {
      const entry = getOrCreateEntry(entries, id)
      entry.state = { ...entry.state, ...partial }
      notifySubscribers(entry)
    },

    set (id: string, data: EntityData): void {
      const entry = getOrCreateEntry(entries, id)
      entry.state = { ...data }
      notifySubscribers(entry)
    },

    get (id: string): EntityData | undefined {
      const entry = entries.get(id)
      if (entry === undefined) return undefined
      return entry.state
    }
  }
}
