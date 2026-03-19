// CDN-aware Cache-Control helpers.
// Named profiles for common caching strategies.

import type { ServerResponse } from 'node:http'

export type CacheProfile = 'immutable' | 'revalidate' | 'private' | 'island'

export interface CacheOptions {
  readonly maxAge?: number
}

const YEAR_SECONDS = 31_536_000

const profileMap: Record<CacheProfile, (options?: CacheOptions) => string> = {
  immutable: () => `public, max-age=${YEAR_SECONDS}, immutable`,
  revalidate: () => 'public, max-age=60, stale-while-revalidate=300',
  private: () => 'private, no-cache',
  island: (options) => {
    const maxAge = options?.maxAge ?? 60
    const swr = Math.floor(maxAge / 2)
    return `public, max-age=${maxAge}, stale-while-revalidate=${swr}`
  }
}

export function cacheControl (profile: CacheProfile, options?: CacheOptions): string {
  return profileMap[profile](options)
}

export function setCacheHeaders (
  res: ServerResponse,
  profile: CacheProfile,
  options?: CacheOptions
): void {
  res.setHeader('Cache-Control', cacheControl(profile, options))
}

export function versionedUrl (url: string, version: string): string {
  if (version === '') return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${version}`
}
