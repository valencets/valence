import { describe, it, expect } from 'vitest'
import { renderContactForm, renderContactSuccess } from '../templates/contact.js'
import { validateContact, SUBJECTS } from '../schemas/contact-schema.js'

describe('renderContactForm', () => {
  it('renders form with all fields', () => {
    const html = renderContactForm()
    expect(html).toContain('name="name"')
    expect(html).toContain('name="email"')
    expect(html).toContain('name="business"')
    expect(html).toContain('name="subject"')
    expect(html).toContain('name="message"')
  })

  it('renders subject options', () => {
    const html = renderContactForm()
    for (const subject of SUBJECTS) {
      expect(html).toContain(subject)
    }
  })

  it('does NOT include Analytics & Conversion as a subject', () => {
    expect(SUBJECTS).not.toContain('Analytics & Conversion')
  })

  it('shows validation errors when provided', () => {
    const errors = {
      code: 'CONTACT_VALIDATION_ERROR' as const,
      fields: [{ field: 'name', message: 'Name is required' }]
    }
    const html = renderContactForm(errors)
    expect(html).toContain('Name is required')
    expect(html).toContain('form-error')
  })

  it('preserves form values on re-render', () => {
    const values = { name: 'Jane', email: 'jane@test.com', business: '', subject: '', message: '' }
    const html = renderContactForm(undefined, values)
    expect(html).toContain('value="Jane"')
    expect(html).toContain('value="jane@test.com"')
  })

  it('has telemetry attributes', () => {
    const html = renderContactForm()
    expect(html).toContain('data-telemetry-target="contact-form"')
    expect(html).toContain('data-telemetry-target="contact-submit"')
  })
})

describe('renderContactForm layout', () => {
  it('contains phone number', () => {
    const html = renderContactForm()
    expect(html).toContain('972-815-7910')
  })

  it('contains email address', () => {
    const html = renderContactForm()
    expect(html).toContain('mail@forrestblade.com')
  })

  it('uses contact-info class for horizontal info bar', () => {
    const html = renderContactForm()
    expect(html).toContain('contact-info')
    expect(html).not.toContain('grid-2')
  })

  it('has telemetry on phone link', () => {
    const html = renderContactForm()
    expect(html).toContain('INTENT_CALL')
  })
})

describe('renderContactSuccess', () => {
  it('shows success message', () => {
    const html = renderContactSuccess()
    expect(html).toContain('Message Sent')
    expect(html).toContain('48 hours')
  })

  it('has link back to home', () => {
    const html = renderContactSuccess()
    expect(html).toContain('href="/"')
  })
})

describe('validateContact', () => {
  const validData = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'General Inquiry',
    message: 'Hello, I am interested in your services.'
  }

  it('accepts valid data', () => {
    const result = validateContact(validData)
    expect(result.isOk()).toBe(true)
  })

  it('rejects missing name', () => {
    const result = validateContact({ ...validData, name: '' })
    expect(result.isErr()).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = validateContact({ ...validData, email: 'not-email' })
    expect(result.isErr()).toBe(true)
  })

  it('rejects short message', () => {
    const result = validateContact({ ...validData, message: 'Hi' })
    expect(result.isErr()).toBe(true)
  })

  it('rejects invalid subject', () => {
    const result = validateContact({ ...validData, subject: 'Invalid' })
    expect(result.isErr()).toBe(true)
  })

  it('accepts optional business name', () => {
    const result = validateContact({ ...validData, business: 'Acme Inc' })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.business).toBe('Acme Inc')
    }
  })

  it('returns typed error with field details', () => {
    const result = validateContact({ name: '', email: 'bad', subject: 'nope', message: '' })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('CONTACT_VALIDATION_ERROR')
      expect(result.error.fields.length).toBeGreaterThan(0)
    }
  })
})
