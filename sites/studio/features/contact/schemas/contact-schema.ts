import { z } from 'zod'
import { ok, err } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'

export const SUBJECTS = [
  'Build & Own',
  'Infrastructure Pipe',
  'Managed Webmaster',
  'Free Audit',
  'General Inquiry'
] as const

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email is required').max(320),
  business: z.string().max(200).optional(),
  subject: z.enum(SUBJECTS),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000)
})

export type ContactData = z.infer<typeof contactSchema>

export interface ContactValidationError {
  readonly code: 'CONTACT_VALIDATION_ERROR'
  readonly fields: ReadonlyArray<{ readonly field: string; readonly message: string }>
}

export function validateContact (data: unknown): Result<ContactData, ContactValidationError> {
  const parsed = contactSchema.safeParse(data)

  if (parsed.success) {
    return ok(parsed.data)
  }

  const fields = parsed.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message
  }))

  return err({
    code: 'CONTACT_VALIDATION_ERROR',
    fields
  })
}
