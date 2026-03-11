import type { DeltaResult } from '../types.js'

export function formatDelta (current: number, previous: number): DeltaResult {
  if (previous === 0 && current === 0) {
    return { value: '0%', direction: 'flat' }
  }

  if (previous === 0) {
    return { value: '+100%', direction: 'up' }
  }

  const change = ((current - previous) / previous) * 100
  const rounded = Math.round(change)

  if (rounded === 0) {
    return { value: '0%', direction: 'flat' }
  }

  const prefix = rounded > 0 ? '+' : ''
  const direction = rounded > 0 ? 'up' : 'down'

  return {
    value: `${prefix}${String(rounded)}%`,
    direction
  }
}
