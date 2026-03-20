import { describe, it, expect } from 'vitest'
import { renderFieldInput } from '../admin/field-renderers.js'
import { field } from '../schema/fields.js'

describe('media field renderer', () => {
  it('renders file input instead of text input', () => {
    const html = renderFieldInput(field.media({ name: 'image', relationTo: 'media' }), '')
    expect(html).toContain('type="file"')
    expect(html).not.toContain('type="text"')
  })

  it('includes hidden input for the media ID value', () => {
    const html = renderFieldInput(field.media({ name: 'image', relationTo: 'media' }), 'existing-uuid')
    expect(html).toContain('type="hidden"')
    expect(html).toContain('name="image"')
    expect(html).toContain('value="existing-uuid"')
  })

  it('has media-drop-zone wrapper class', () => {
    const html = renderFieldInput(field.media({ name: 'image', relationTo: 'media' }), '')
    expect(html).toContain('media-drop-zone')
  })

  it('shows preview area', () => {
    const html = renderFieldInput(field.media({ name: 'image', relationTo: 'media' }), 'existing-uuid')
    expect(html).toContain('media-preview')
  })

  it('includes data-upload-endpoint attribute', () => {
    const html = renderFieldInput(field.media({ name: 'image', relationTo: 'media' }), '')
    expect(html).toContain('data-upload-endpoint="/media/upload"')
  })
})
