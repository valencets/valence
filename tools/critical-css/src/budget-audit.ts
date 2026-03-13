import { gzipSync } from 'node:zlib'
import { fromThrowable } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'
import { CriticalCSSErrorCode } from './types.js'
import type { CriticalCSSError, BudgetReport } from './types.js'

export const DEFAULT_HEADER_ESTIMATE = 500
export const BUDGET_BYTES = 14_336

// fromThrowable boundary for gzipSync — can throw on buffer issues
const safeGzip = fromThrowable(
  (buf: Buffer) => gzipSync(buf),
  (e: unknown): CriticalCSSError => ({
    code: CriticalCSSErrorCode.COMPRESSION_FAILED,
    message: e instanceof Error ? e.message : 'Unknown compression error'
  })
)

export function auditBudget (
  htmlShell: string,
  criticalCSS: string,
  headerEstimate: number = DEFAULT_HEADER_ESTIMATE
): Result<BudgetReport, CriticalCSSError> {
  const combined = htmlShell + criticalCSS
  const raw = Buffer.from(combined, 'utf-8')
  const totalBytes = raw.length

  return safeGzip(raw).map((compressed) => {
    const compressedBytes = compressed.length
    const effectiveSize = compressedBytes + headerEstimate
    const withinBudget = effectiveSize <= BUDGET_BYTES
    const utilizationPercent = (effectiveSize / BUDGET_BYTES) * 100

    return {
      totalBytes,
      compressedBytes,
      budgetBytes: BUDGET_BYTES,
      headerEstimate,
      withinBudget,
      utilizationPercent
    }
  })
}
