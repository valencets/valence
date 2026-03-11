import { parse as parseQs } from 'node:querystring'
import { ResultAsync } from 'neverthrow'
import type { DbPool, DbError } from '@inertia/db'
import { mapPostgresError } from '@inertia/db'
import type { RouteHandler } from '../../../server/types.js'
import { isFragmentRequest, sendHtml, readBody } from '../../../server/router.js'
import { renderShell, renderFragment } from '../../../server/shell.js'
import { renderContactForm, renderContactSuccess } from '../templates/contact.js'
import { validateContact } from '../schemas/contact-schema.js'

const shellOptions = {
  title: 'Contact',
  description: 'Get in touch with Inertia Web Solutions.',
  criticalCSS: '',
  deferredCSSPath: '/css/studio.css',
  currentPath: '/contact'
}

export const contactGetHandler: RouteHandler = async (req, res) => {
  const mainContent = renderContactForm()

  if (isFragmentRequest(req)) {
    sendHtml(res, renderFragment(mainContent))
    return
  }

  sendHtml(res, renderShell({ ...shellOptions, mainContent }))
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
    const mainContent = renderContactForm(validation.error, values)

    if (isFragmentRequest(req)) {
      sendHtml(res, renderFragment(mainContent), 422)
      return
    }

    sendHtml(res, renderShell({ ...shellOptions, mainContent }), 422)
    return
  }

  // Persist to contact_submissions table
  const data = validation.value
  const insertResult = await insertContactSubmission(ctx.pool, data)

  if (insertResult.isErr()) {
    console.error('Contact insert failed:', insertResult.error.message)
  }

  const mainContent = renderContactSuccess()

  if (isFragmentRequest(req)) {
    sendHtml(res, renderFragment(mainContent))
    return
  }

  sendHtml(res, renderShell({ ...shellOptions, title: 'Message Sent', mainContent }))
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
