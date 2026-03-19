import { describe, it, expect } from 'vitest'
import { renderFieldInput } from '../admin/field-renderers.js'
import { field } from '../schema/fields.js'

describe('renderRichtextEditor', () => {
  it('outputs richtext-wrap container', () => {
    const f = field.richtext({ name: 'body' })
    const html = renderFieldInput(f, '')
    expect(html).toContain('richtext-wrap')
  })

  it('outputs hidden input for form submission', () => {
    const f = field.richtext({ name: 'body' })
    const html = renderFieldInput(f, '<p>Hello</p>')
    expect(html).toContain('type="hidden"')
    expect(html).toContain('name="body"')
  })

  it('outputs richtext-editor div with data-field attribute', () => {
    const f = field.richtext({ name: 'content' })
    const html = renderFieldInput(f, '')
    expect(html).toContain('richtext-editor')
    expect(html).toContain('data-field="content"')
  })

  it('puts existing value in a template tag for hydration', () => {
    const f = field.richtext({ name: 'body' })
    const html = renderFieldInput(f, '<p>Existing content</p>')
    expect(html).toContain('<template')
    expect(html).toContain('Existing content')
  })

  it('does not render template tag when value is empty', () => {
    const f = field.richtext({ name: 'body' })
    const html = renderFieldInput(f, '')
    expect(html).not.toContain('<template')
  })

  it('escapes HTML in the hidden input value', () => {
    const f = field.richtext({ name: 'body' })
    const html = renderFieldInput(f, '<script>alert("xss")</script>')
    // The hidden input value should be escaped
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
  })

  it('renders label with field name', () => {
    const f = field.richtext({ name: 'body', label: 'Body Content' })
    const html = renderFieldInput(f, '')
    expect(html).toContain('Body Content')
  })
})
