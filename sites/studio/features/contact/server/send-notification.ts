import { createTransport } from 'nodemailer'
import { ResultAsync } from '@inertia/neverthrow'

export interface ContactNotification {
  readonly name: string
  readonly email: string
  readonly business?: string | undefined
  readonly subject: string
  readonly message: string
}

interface NotificationError {
  readonly code: 'NOTIFICATION_FAILED'
  readonly message: string
}

function buildPlainText (data: ContactNotification): string {
  const lines = [
    'New contact form submission',
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`
  ]
  if (data.business) lines.push(`Business: ${data.business}`)
  lines.push(`Subject: ${data.subject}`, '', data.message)
  return lines.join('\n')
}

export function sendContactNotification (
  data: ContactNotification,
  recipientEmail: string
): ResultAsync<void, NotificationError> {
  const host = process.env['SMTP_HOST'] ?? ''
  const port = parseInt(process.env['SMTP_PORT'] ?? '587', 10)
  const user = process.env['SMTP_USER'] ?? ''
  const pass = process.env['SMTP_PASS'] ?? ''

  if (host.length === 0 || user.length === 0) {
    return ResultAsync.fromSafePromise(Promise.resolve(undefined as void))
  }

  const transport = createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  })

  return ResultAsync.fromPromise(
    transport.sendMail({
      from: `"Inertia Studio" <${user}>`,
      replyTo: data.email,
      to: recipientEmail,
      subject: `[Contact] ${data.subject} — ${data.name}`,
      text: buildPlainText(data)
    }).then(() => undefined as void),
    (err): NotificationError => ({
      code: 'NOTIFICATION_FAILED',
      message: err instanceof Error ? err.message : 'Unknown SMTP error'
    })
  )
}
