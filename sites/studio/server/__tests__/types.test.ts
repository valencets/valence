import { describe, it, expect } from 'vitest'
import type { RouteContext } from '../types.js'
import type { CriticalCSSCache } from '../../features/budget/critical-css-pipeline.js'

describe('RouteContext', () => {
  it('requires cssPipeline field', () => {
    const mockPipeline: CriticalCSSCache = {
      getCriticalCSS: () => undefined,
      getDeferredCSS: () => undefined
    }

    const ctx: RouteContext = {
      pool: {} as RouteContext['pool'],
      config: {} as RouteContext['config'],
      cssPipeline: mockPipeline
    }

    expect(ctx.cssPipeline).toBeDefined()
    expect(ctx.cssPipeline.getCriticalCSS('/')).toBeUndefined()
  })
})
