import type { ReferrerCategory } from '../types.js'

const SEARCH_DOMAINS: ReadonlyArray<string> = [
  'google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com',
  'baidu.com', 'yandex.com', 'ecosia.org'
]

const SOCIAL_DOMAINS: ReadonlyArray<string> = [
  'facebook.com', 'instagram.com', 'tiktok.com', 'x.com',
  'twitter.com', 'nextdoor.com', 'linkedin.com', 'youtube.com'
]

const REFERRAL_DOMAINS: ReadonlyArray<string> = [
  'yelp.com', 'yellowpages.com', 'bbb.org', 'angi.com',
  'thumbtack.com', 'homeadvisor.com'
]

const DOMAIN_MAP: Record<string, ReferrerCategory> = {}

for (const d of SEARCH_DOMAINS) { DOMAIN_MAP[d] = 'Search' }
for (const d of SOCIAL_DOMAINS) { DOMAIN_MAP[d] = 'Social' }
for (const d of REFERRAL_DOMAINS) { DOMAIN_MAP[d] = 'Referral' }

function extractHostname (referrer: string): string {
  const trimmed = referrer.trim().toLowerCase()
  if (trimmed === '') return ''

  let hostname = trimmed
  const protoIndex = hostname.indexOf('//')
  if (protoIndex !== -1) {
    hostname = hostname.slice(protoIndex + 2)
  }
  const pathIndex = hostname.indexOf('/')
  if (pathIndex !== -1) {
    hostname = hostname.slice(0, pathIndex)
  }
  if (hostname.startsWith('www.')) {
    hostname = hostname.slice(4)
  }
  return hostname
}

export function classifyReferrer (referrer: string): ReferrerCategory {
  const hostname = extractHostname(referrer)
  if (hostname === '') return 'Direct'

  const mapped = DOMAIN_MAP[hostname]
  if (mapped !== undefined) return mapped

  return 'Other'
}

export interface CategoryCount {
  readonly category: ReferrerCategory
  readonly count: number
  readonly percent: number
}

export function aggregateByCategory (
  sources: ReadonlyArray<{ readonly referrer: string; readonly count: number }>
): ReadonlyArray<CategoryCount> {
  const totals: Record<string, number> = {}
  let sum = 0

  for (const s of sources) {
    const cat = classifyReferrer(s.referrer)
    totals[cat] = (totals[cat] ?? 0) + s.count
    sum += s.count
  }

  if (sum === 0) return []

  return Object.entries(totals)
    .map(([category, count]) => ({
      category: category as ReferrerCategory,
      count,
      percent: Math.round((count / sum) * 100)
    }))
    .sort((a, b) => b.count - a.count)
}
