import { SUBJECTS } from '../schemas/contact-schema.js'
import type { ContactValidationError } from '../schemas/contact-schema.js'

export function renderContactForm (errors?: ContactValidationError, values?: Record<string, string>): string {
  const subjectOptions = SUBJECTS.map((s) => {
    const selected = values?.['subject'] === s ? ' selected' : ''
    return `<option value="${s}"${selected}>${s}</option>`
  }).join('')

  const fieldError = (field: string): string => {
    if (!errors) return ''
    const found = errors.fields.find((f) => f.field === field)
    return found ? `<p class="form-error">${found.message}</p>` : ''
  }

  return `
<section class="section container">
  <h1>Contact Us</h1>
  <p class="prose">Tell us about your project. We'll get back to you within 48 hours.</p>

  <div class="grid grid-2">
    <form method="POST" action="/contact" class="contact-form" data-telemetry-type="FORM_INPUT" data-telemetry-target="contact-form">
      <div class="form-group">
        <label for="name" class="form-label">Name *</label>
        <input type="text" id="name" name="name" class="form-input" required value="${values?.['name'] ?? ''}" autocomplete="name">
        ${fieldError('name')}
      </div>

      <div class="form-group">
        <label for="email" class="form-label">Email *</label>
        <input type="email" id="email" name="email" class="form-input" required value="${values?.['email'] ?? ''}" autocomplete="email">
        ${fieldError('email')}
      </div>

      <div class="form-group">
        <label for="business" class="form-label">Business Name</label>
        <input type="text" id="business" name="business" class="form-input" value="${values?.['business'] ?? ''}" autocomplete="organization">
        ${fieldError('business')}
      </div>

      <div class="form-group">
        <label for="subject" class="form-label">Subject *</label>
        <select id="subject" name="subject" class="form-select" required>
          <option value="">Select a subject...</option>
          ${subjectOptions}
        </select>
        ${fieldError('subject')}
      </div>

      <div class="form-group">
        <label for="message" class="form-label">Message *</label>
        <textarea id="message" name="message" class="form-textarea" required minlength="10">${values?.['message'] ?? ''}</textarea>
        ${fieldError('message')}
      </div>

      <button type="submit" class="btn btn-primary" data-telemetry-type="CLICK" data-telemetry-target="contact-submit">Send Message</button>
    </form>

    <div class="card">
      <h3>Prefer to talk? Reach out directly.</h3>
      <p style="margin-top: 1rem;">
        <a href="tel:+19728157910" data-telemetry-type="INTENT_CALL" data-telemetry-target="contact-phone">972-815-7910</a>
      </p>
      <p style="margin-top: 0.5rem;">
        <a href="mailto:mail@forrestblade.com" data-telemetry-type="INTENT_LEAD" data-telemetry-target="contact-email">mail@forrestblade.com</a>
      </p>
    </div>
  </div>
</section>`
}

export function renderContactSuccess (): string {
  return `
<section class="section container">
  <h1>Message Sent</h1>
  <p class="form-success">Thank you for reaching out. We'll get back to you within 48 hours.</p>
  <a href="/" class="btn btn-secondary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="contact-success-home">Back to Home</a>
</section>`
}
