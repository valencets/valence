import { parse as parseQs } from 'node:querystring'
import { ResultAsync } from '@inertia/neverthrow'
import type { DbPool, DbError } from '@inertia/db'
import { mapPostgresError } from '@inertia/db'
import type { RouteHandler } from '../../../server/types.js'
import { respondWithPage } from '../../../server/page-helpers.js'
import { renderContactForm, renderContactSuccess } from '../templates/contact.js'
import { validateContact } from '../schemas/contact-schema.js'
import { readBody } from '../../../server/router.js'
import { sendContactNotification } from './send-notification.js'

const pageBase = {
  title: 'Contact',
  description: 'Get in touch with Inertia Web Solutions.',
  deferredCSSPath: '/css/studio.css',
  currentPath: '/contact'
}

export const contactGetHandler: RouteHandler = async (_req, res) => {
  res.writeHead(301, { Location: '/about#contact' })
  res.end()
}

export const contactPostHandler: RouteHandler = async (req, res, ctx) => {
  const raw = await readBody(req)
  const parsed = parseQs(raw)

  const values: Record<string, string> = {
    name: String(parsed['name'] ?? ''),
    email: String(parsed['email'] ?? ''),
    business: String(parsed['business'] ?? ''),
    subject: String(parsed['subject'] ?? ''),
    message: String(parsed['message'] ?? '')
  }

  const validation = validateContact(values)

  if (validation.isErr()) {
    respondWithPage(req, res, ctx, {
      ...pageBase,
      mainContent: renderContactForm(validation.error, values)
    }, 422)
    return
  }

  // Persist to contact_submissions table
  const data = validation.value
  const insertResult = await insertContactSubmission(ctx.pool, data)

  if (insertResult.isErr()) {
    console.error('Contact insert failed:', insertResult.error.message)
  }

  // Send email notification (fire-and-forget, don't block response)
  const notifyEmail = process.env['CONTACT_NOTIFY_EMAIL'] ?? 'mail@forrestblade.com'
  sendContactNotification(data, notifyEmail).match(
    () => {},
    (notifyErr) => { console.error('[contact] email notification failed:', notifyErr.message) }
  )

  respondWithPage(req, res, ctx, {
    ...pageBase,
    title: 'Message Sent',
    mainContent: renderContactSuccess()
  })
}

function insertContactSubmission (
  pool: DbPool,
  data: { name: string; email: string; business?: string | undefined; subject: string; message: string }
): ResultAsync<unknown, DbError> {
  return ResultAsync.fromPromise(
    pool.sql`
      INSERT INTO contact_submissions (name, email, business_name, subject, message)
      VALUES (${data.name}, ${data.email}, ${data.business ?? null}, ${data.subject}, ${data.message})
    `,
    mapPostgresError
  )
}
