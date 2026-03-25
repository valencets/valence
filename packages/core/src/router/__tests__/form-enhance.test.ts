import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  initFormEnhancement,
  shouldEnhanceForm,
  serializeForm
} from '../form-enhance.js'
import type { FormEnhanceHandle } from '../form-enhance.js'

// Helper to create a form element
function createForm (attrs: Record<string, string> = {}, method = 'post', action = '/submit'): HTMLFormElement {
  const form = document.createElement('form')
  form.method = method
  form.action = action
  for (const [key, value] of Object.entries(attrs)) {
    form.setAttribute(key, value)
  }
  document.body.appendChild(form)
  return form
}

function createInput (form: HTMLFormElement, name: string, value: string): HTMLInputElement {
  const input = document.createElement('input')
  input.name = name
  input.value = value
  form.appendChild(input)
  return input
}

function submitForm (form: HTMLFormElement): SubmitEvent {
  const event = new Event('submit', { bubbles: true, cancelable: true }) as SubmitEvent
  form.dispatchEvent(event)
  return event
}

function createMockFetch (response: Partial<Response> = {}): typeof fetch {
  return vi.fn<typeof fetch>().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => '<html><body><p>Success</p></body></html>',
    ...response
  } as Response)
}

describe('shouldEnhanceForm', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('returns true for forms with data-val-enhance attribute', () => {
    const form = createForm({ 'data-val-enhance': '' })
    expect(shouldEnhanceForm(form)).toBe(true)
  })

  it('returns false for forms without data-val-enhance', () => {
    const form = createForm()
    expect(shouldEnhanceForm(form)).toBe(false)
  })

  it('returns true for forms inside a val-outlet element', () => {
    const outlet = document.createElement('val-outlet')
    document.body.appendChild(outlet)
    const form = createForm()
    outlet.appendChild(form)
    expect(shouldEnhanceForm(form)).toBe(true)
  })

  it('returns false for forms outside val-outlet without attribute', () => {
    const form = createForm()
    expect(shouldEnhanceForm(form)).toBe(false)
  })

  it('returns true with data-val-enhance even if outside val-outlet', () => {
    const form = createForm({ 'data-val-enhance': 'true' })
    expect(shouldEnhanceForm(form)).toBe(true)
  })
})

describe('serializeForm', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('serializes form fields to URLSearchParams', () => {
    const form = createForm()
    createInput(form, 'name', 'Alice')
    createInput(form, 'email', 'alice@example.com')
    const params = serializeForm(form)
    expect(params.get('name')).toBe('Alice')
    expect(params.get('email')).toBe('alice@example.com')
  })

  it('returns empty URLSearchParams for empty form', () => {
    const form = createForm()
    const params = serializeForm(form)
    expect(params.toString()).toBe('')
  })

  it('handles multiple values for the same field name', () => {
    const form = createForm()
    // Use text inputs to reliably test multiple values
    const input1 = document.createElement('input')
    input1.type = 'hidden'
    input1.name = 'tags'
    input1.value = 'news'
    form.appendChild(input1)
    const input2 = document.createElement('input')
    input2.type = 'hidden'
    input2.name = 'tags'
    input2.value = 'tech'
    form.appendChild(input2)
    const params = serializeForm(form)
    expect(params.getAll('tags')).toContain('news')
    expect(params.getAll('tags')).toContain('tech')
  })

  it('excludes unchecked checkboxes', () => {
    const form = createForm()
    const input = createInput(form, 'subscribe', 'yes')
    input.type = 'checkbox'
    input.checked = false
    const params = serializeForm(form)
    expect(params.has('subscribe')).toBe(false)
  })
})

describe('initFormEnhancement', () => {
  let handle: FormEnhanceHandle | null = null

  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  afterEach(() => {
    handle?.destroy()
    handle = null
    document.body.innerHTML = ''
  })

  it('returns a handle with destroy method', () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)
    expect(typeof handle.destroy).toBe('function')
  })

  it('does not intercept unenhanced form submission', () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)

    const form = createForm()
    createInput(form, 'name', 'test')
    submitForm(form)

    // Without enhancement, event should not be prevented by our handler
    // (it will bubble normally and be cancelable)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('intercepts enhanced form submission', async () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)

    document.body.innerHTML = '<div id="main"><p>Content</p></div>'
    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/submit'
    createInput(form, 'name', 'Alice')

    submitForm(form)
    await Promise.resolve() // allow microtasks

    expect(mockFetch).toHaveBeenCalled()
  })

  it('sends POST request with form data', async () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)

    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/contact'
    form.method = 'post'
    createInput(form, 'email', 'test@example.com')

    submitForm(form)
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/contact'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('includes X-Valence-Fragment header in request', async () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)

    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/submit'
    createInput(form, 'x', '1')

    submitForm(form)
    await Promise.resolve()

    const [, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-Valence-Fragment']).toBe('1')
  })

  it('includes CSRF token in request when cookie is set', async () => {
    document.cookie = '__val_csrf=test-token-123'
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)

    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/submit'
    createInput(form, 'x', '1')

    submitForm(form)
    await Promise.resolve()

    const [, init] = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-CSRF-Token']).toBe('test-token-123')
  })

  it('navigates when X-Valence-Redirect is present', async () => {
    const mockFetch = createMockFetch({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-Valence-Redirect': '/done' })
    })
    const mockNavigate = vi.fn()
    handle = initFormEnhancement({ onNavigate: mockNavigate }, mockFetch)

    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/submit'
    createInput(form, 'x', '1')

    submitForm(form)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mockNavigate).toHaveBeenCalledWith('/done')
  })

  it('does not navigate based on redirect status alone', async () => {
    const mockFetch = createMockFetch({
      ok: false,
      status: 302,
      headers: new Headers()
    })
    const mockNavigate = vi.fn()
    handle = initFormEnhancement({ onNavigate: mockNavigate }, mockFetch)

    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/submit'
    createInput(form, 'x', '1')

    submitForm(form)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('does not enhance multipart forms', async () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)

    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/upload'
    form.enctype = 'multipart/form-data'
    createInput(form, 'title', 'Upload')

    const event = submitForm(form)
    await Promise.resolve()

    expect(mockFetch).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('does not enhance forms with file inputs', async () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)

    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/upload'
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.name = 'asset'
    form.appendChild(fileInput)

    const event = submitForm(form)
    await Promise.resolve()

    expect(mockFetch).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
  })

  it('does not use a raw promise catch in form enhancement', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('src/router/form-enhance.ts', 'utf-8')
    expect(source).not.toMatch(/fetchFn\(url, \{ method, headers, body \}\)\s*\.then/)
    expect(source).not.toMatch(/\.catch\(/)
  })

  it('destroy removes event listener — no longer intercepts after destroy', async () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)
    handle.destroy()
    handle = null

    const form = createForm({ 'data-val-enhance': '' })
    form.action = 'http://localhost:3000/submit'
    createInput(form, 'x', '1')

    submitForm(form)
    await Promise.resolve()

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('intercepts forms inside val-outlet even without data-val-enhance', async () => {
    const mockFetch = createMockFetch()
    handle = initFormEnhancement(undefined, mockFetch)

    const outlet = document.createElement('val-outlet')
    document.body.appendChild(outlet)
    const form = createForm()
    form.action = 'http://localhost:3000/contact'
    outlet.appendChild(form)
    createInput(form, 'msg', 'hello')

    submitForm(form)
    await Promise.resolve()

    expect(mockFetch).toHaveBeenCalled()
  })
})
