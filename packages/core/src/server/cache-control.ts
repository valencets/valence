// CDN-aware Cache-Control helpers.
// Named profiles for common caching strategies.

import type { ServerResponse } from 'node:http'

export type CacheProfile = 'immutable' | 'revalidate' | 'private' | 'island'

export interface CacheOptions {
  readonly maxAge?: number
}

const YEAR_SECONDS = 31_536_000

export function cacheControl (profile: CacheProfile, options?: CacheOptions): string {
  switch (profile) {
    case 'immutable':
      return `public, max-age=${YEAR_SECONDS}, immutable`
    case 'revalidate':
      return 'public, max-age=60, stale-while-revalidate=300'
    case 'private':
      return 'private, no-cache'
    case 'island': {
      const maxAge = options?.maxAge ?? 60
      const swr = Math.floor(maxAge / 2)
      return `public, max-age=${maxAge}, stale-while-revalidate=${swr}`
    }
  }
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
