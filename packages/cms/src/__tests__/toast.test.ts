import { describe, it, expect } from 'vitest'
import { renderToast } from '../admin/toast.js'
import { renderLayout } from '../admin/layout.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('renderToast()', () => {
  it('renders error toast with role=alert', () => {
    const html = renderToast({ type: 'error', text: 'Validation failed' })
    expect(html).toContain('class="toast toast-error"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Validation failed')
  })

  it('renders success toast', () => {
    const html = renderToast({ type: 'success', text: 'Post created' })
    expect(html).toContain('toast-success')
    expect(html).toContain('Post created')
  })

  it('renders info toast', () => {
    const html = renderToast({ type: 'info', text: 'Draft saved' })
    expect(html).toContain('toast-info')
  })

  it('includes dismiss button', () => {
    const html = renderToast({ type: 'error', text: 'err' })
    expect(html).toContain('toast-dismiss')
    expect(html).toContain('aria-label="Dismiss"')
  })

  it('escapes HTML in message text', () => {
    const html = renderToast({ type: 'error', text: '<script>alert("xss")</script>' })
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('renderLayout() with toast', () => {
  const col = collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [field.text({ name: 'title' })]
  })

  it('renders toast when provided', () => {
    const html = renderLayout({
      title: 'Test',
      content: '<p>hi</p>',
      collections: [col],
      toast: { type: 'error', text: 'Something went wrong' }
    })
    expect(html).toContain('toast-error')
    expect(html).toContain('Something went wrong')
  })

  it('includes auto-dismiss script when toast is present', () => {
    const html = renderLayout({
      title: 'Test',
      content: '',
      collections: [col],
      toast: { type: 'success', text: 'Saved' }
    })
    expect(html).toContain('<script>')
    expect(html).toContain('toast-fade')
  })

  it('does not include toast or script when no toast', () => {
    const html = renderLayout({
      title: 'Test',
      content: '',
      collections: [col]
    })
    expect(html).not.toContain('class="toast')
    expect(html).not.toContain('<script>')
  })

  it('includes toast CSS', () => {
    const html = renderLayout({
      title: 'Test',
      content: '',
      collections: [col]
    })
    expect(html).toContain('.toast {')
    expect(html).toContain('.toast-error')
    expect(html).toContain('.toast-success')
    expect(html).toContain('.toast-dismiss')
  })
})
