import { describe, it, expect, beforeEach } from 'vitest'
import { validateFragmentResponse, stripScripts } from '../fragment-swap.js'
import { RouterErrorCode } from '../router-types.js'

describe('validateFragmentResponse', () => {
  it('returns ok for valid fragment (text/html + X-Valence-Fragment header)', () => {
    const response = new Response('<p>content</p>', {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Valence-Fragment': '1'
      }
    })
    const result = validateFragmentResponse(response)
    expect(result.isOk()).toBe(true)
  })

  it('returns error for non-text/html Content-Type', () => {
    const response = new Response('{}', {
      headers: {
        'Content-Type': 'application/json',
        'X-Valence-Fragment': '1'
      }
    })
    const result = validateFragmentResponse(response)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(RouterErrorCode.NOT_HTML_RESPONSE)
    }
  })

  it('returns error for missing X-Valence-Fragment header', () => {
    const response = new Response('<p>content</p>', {
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    })
    const result = validateFragmentResponse(response)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(RouterErrorCode.PARSE_FAILED)
    }
  })
})

describe('stripScripts', () => {
  let doc: Document

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('test')
  })

  it('removes all script elements from a Document', () => {
    doc.body.innerHTML = '<p>Hello</p><script>alert("xss")</script><div>Safe</div><script>evil()</script>'
    stripScripts(doc)
    expect(doc.querySelectorAll('script').length).toBe(0)
    expect(doc.querySelector('p')?.textContent).toBe('Hello')
    expect(doc.querySelector('div')?.textContent).toBe('Safe')
  })

  it('keeps script elements with matching nonce attribute', () => {
    doc.body.innerHTML = '<script nonce="abc123">safe()</script><script>evil()</script><script nonce="abc123">also_safe()</script>'
    stripScripts(doc, 'abc123')
    const scripts = doc.querySelectorAll('script')
    expect(scripts.length).toBe(2)
    expect(scripts[0]?.textContent).toBe('safe()')
    expect(scripts[1]?.textContent).toBe('also_safe()')
  })

  it('removes scripts with wrong nonce', () => {
    doc.body.innerHTML = '<script nonce="wrong">evil()</script><script nonce="right">safe()</script>'
    stripScripts(doc, 'right')
    const scripts = doc.querySelectorAll('script')
    expect(scripts.length).toBe(1)
    expect(scripts[0]?.textContent).toBe('safe()')
  })

  it('handles document with no scripts', () => {
    doc.body.innerHTML = '<p>No scripts here</p>'
    stripScripts(doc)
    expect(doc.querySelector('p')?.textContent).toBe('No scripts here')
  })
})
