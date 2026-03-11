// Barrel export — named exports only, no default exports
import type { Result } from 'neverthrow'
import { extractSelectors } from './extract-selectors.js'
import { splitCSS } from './split-css.js'
import type { CriticalCSSError, SplitResult } from './types.js'

// Convenience wrapper: HTML + CSS → { critical, deferred }
export function extractCriticalCSS (
  fullCSS: string,
  htmlString: string
): Result<SplitResult, CriticalCSSError> {
  return extractSelectors(htmlString)
    .andThen((selectors) => splitCSS(fullCSS, selectors))
}

// Re-exports
export { extractSelectors } from './extract-selectors.js'
export { splitCSS } from './split-css.js'
export { auditBudget, BUDGET_BYTES, DEFAULT_HEADER_ESTIMATE } from './budget-audit.js'
export {
  CriticalCSSErrorCode
} from './types.js'
export type {
  CriticalCSSError,
  ExtractedSelectors,
  SplitResult,
  BudgetReport
} from './types.js'
