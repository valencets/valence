import { ok, err } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'
import { z } from 'zod'
import type { ValidationFailure } from './schemas.js'

const topReferrerSchema = z.object({
  referrer: z.string(),
  count: z.number().int()
})

const topPageSchema = z.object({
  path: z.string(),
  count: z.number().int()
})

const dailySummarySchema = z.object({
  site_id: z.string().min(1),
  date: z.string().min(1),
  business_type: z.string().min(1),
  schema_version: z.literal(1),
  session_count: z.number().int().nullable(),
  pageview_count: z.number().int().nullable(),
  conversion_count: z.number().int().nullable(),
  top_referrers: z.array(topReferrerSchema).max(10).nullable(),
  top_pages: z.array(topPageSchema).max(10).nullable(),
  intent_counts: z.record(z.string(), z.number().int()).nullable(),
  avg_flush_ms: z.number().nullable(),
  rejection_count: z.number().int().nullable()
})

export type DailySummaryPayload = z.infer<typeof dailySummarySchema>

export function validateDailySummary (data: unknown): Result<DailySummaryPayload, ValidationFailure> {
  const parsed = dailySummarySchema.safeParse(data)

  if (parsed.success) {
    return ok(parsed.data)
  }

  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }))

  return err({
    code: 'VALIDATION_FAILURE',
    message: `Daily summary validation failed with ${issues.length} issue(s)`,
    issues
  })
}
