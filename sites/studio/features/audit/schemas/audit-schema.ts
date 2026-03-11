import { z } from 'zod'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { AuditError } from '../types/audit-types.js'
import { AuditErrorCode } from '../types/audit-types.js'

const urlSchema = z.string().url('Must be a valid URL').refine(
  (url) => url.startsWith('http://') || url.startsWith('https://'),
  { message: 'URL must start with http:// or https://' }
)

export function validateAuditUrl (input: unknown): Result<string, AuditError> {
  const parsed = urlSchema.safeParse(input)

  if (parsed.success) {
    return ok(parsed.data)
  }

  return err({
    code: AuditErrorCode.INVALID_URL,
    message: parsed.error.issues.map((i) => i.message).join('; ')
  })
}
