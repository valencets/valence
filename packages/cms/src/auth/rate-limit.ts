// Intentionally mutable — count is incremented in-place by check()
interface RateLimitEntry {
  count: number
  firstAttempt: number
}

interface RateLimitConfig {
  readonly maxAttempts: number
  readonly windowMs: number
}

export interface RateLimiter {
  check (key: string): boolean
  reset (key: string): void
  remaining (key: string): number
}

const MAX_ENTRIES = 10_000

export function createRateLimiter (config: RateLimitConfig): RateLimiter {
  const entries = new Map<string, RateLimitEntry>()

  function getEntry (key: string): RateLimitEntry {
    const now = Date.now()
    const existing = entries.get(key)
    if (!existing || (now - existing.firstAttempt) > config.windowMs) {
      // Evict oldest entry if over cap to prevent memory exhaustion (AUTH-02)
      if (entries.size >= MAX_ENTRIES) {
        const oldest = entries.keys().next().value
        if (oldest !== undefined) entries.delete(oldest)
      }
      const entry: RateLimitEntry = { count: 0, firstAttempt: now }
      entries.set(key, entry)
      return entry
    }
    return existing
  }

  return {
    check (key: string): boolean {
      const entry = getEntry(key)
      if (entry.count >= config.maxAttempts) return false
      entry.count++
      return true
    },

    reset (key: string): void {
      entries.delete(key)
    },

    remaining (key: string): number {
      const entry = getEntry(key)
      return Math.max(0, config.maxAttempts - entry.count)
    }
  }
}
