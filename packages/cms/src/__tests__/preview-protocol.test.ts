import { describe, it, expect } from 'vitest'
import {
  PREVIEW_MESSAGE_TYPE,
  isPreviewMessage,
  parsePreviewData
} from '../admin/preview-protocol.js'
import {
  PREVIEW_MESSAGE_TYPE as BARREL_PREVIEW_MESSAGE_TYPE,
  isPreviewMessage as barrelIsPreviewMessage,
  parsePreviewData as barrelParsePreviewData
} from '../index.js'

describe('PREVIEW_MESSAGE_TYPE', () => {
  it('is the string "valence:preview-update"', () => {
    expect(PREVIEW_MESSAGE_TYPE).toBe('valence:preview-update')
  })
})

describe('isPreviewMessage()', () => {
  it('returns true for a valid preview MessageEvent', () => {
    const event = new MessageEvent('message', {
      data: { type: 'valence:preview-update', data: { title: 'Hello' } }
    })
    expect(isPreviewMessage(event)).toBe(true)
  })

  it('returns false when data is null', () => {
    const event = new MessageEvent('message', { data: null })
    expect(isPreviewMessage(event)).toBe(false)
  })

  it('returns false when data is not an object', () => {
    const event = new MessageEvent('message', { data: 'string-message' })
    expect(isPreviewMessage(event)).toBe(false)
  })

  it('returns false when type field is missing', () => {
    const event = new MessageEvent('message', {
      data: { data: { title: 'Hello' } }
    })
    expect(isPreviewMessage(event)).toBe(false)
  })

  it('returns false when type is wrong', () => {
    const event = new MessageEvent('message', {
      data: { type: 'other:message', data: { title: 'Hello' } }
    })
    expect(isPreviewMessage(event)).toBe(false)
  })

  it('returns false when data field is not an object', () => {
    const event = new MessageEvent('message', {
      data: { type: 'valence:preview-update', data: 'not-an-object' }
    })
    expect(isPreviewMessage(event)).toBe(false)
  })

  it('returns false when data field is null', () => {
    const event = new MessageEvent('message', {
      data: { type: 'valence:preview-update', data: null }
    })
    expect(isPreviewMessage(event)).toBe(false)
  })

  it('returns false when data field is missing', () => {
    const event = new MessageEvent('message', {
      data: { type: 'valence:preview-update' }
    })
    expect(isPreviewMessage(event)).toBe(false)
  })
})

describe('parsePreviewData()', () => {
  it('extracts data from a valid preview message', () => {
    const event = new MessageEvent('message', {
      data: { type: 'valence:preview-update', data: { title: 'My Post', slug: 'my-post' } }
    })
    const result = parsePreviewData(event)
    expect(result).toEqual({ title: 'My Post', slug: 'my-post' })
  })

  it('returns null for non-preview messages', () => {
    const event = new MessageEvent('message', {
      data: { type: 'other:event', data: { foo: 'bar' } }
    })
    const result = parsePreviewData(event)
    expect(result).toBeNull()
  })

  it('returns null for null data', () => {
    const event = new MessageEvent('message', { data: null })
    const result = parsePreviewData(event)
    expect(result).toBeNull()
  })

  it('returns null for string data', () => {
    const event = new MessageEvent('message', { data: 'hello' })
    const result = parsePreviewData(event)
    expect(result).toBeNull()
  })

  it('returns empty object when doc data is empty', () => {
    const event = new MessageEvent('message', {
      data: { type: 'valence:preview-update', data: {} }
    })
    const result = parsePreviewData(event)
    expect(result).toEqual({})
  })
})

describe('preview-protocol exports', () => {
  it('PREVIEW_MESSAGE_TYPE is a string constant', () => {
    expect(typeof PREVIEW_MESSAGE_TYPE).toBe('string')
  })

  it('isPreviewMessage is a function', () => {
    expect(typeof isPreviewMessage).toBe('function')
  })

  it('parsePreviewData is a function', () => {
    expect(typeof parsePreviewData).toBe('function')
  })
})

describe('CMS barrel re-exports preview-protocol', () => {
  it('exports PREVIEW_MESSAGE_TYPE from barrel', () => {
    expect(BARREL_PREVIEW_MESSAGE_TYPE).toBe('valence:preview-update')
  })

  it('exports isPreviewMessage from barrel', () => {
    expect(typeof barrelIsPreviewMessage).toBe('function')
  })

  it('exports parsePreviewData from barrel', () => {
    expect(typeof barrelParsePreviewData).toBe('function')
  })

  it('barrel isPreviewMessage works correctly', () => {
    const event = new MessageEvent('message', {
      data: { type: 'valence:preview-update', data: { slug: 'test' } }
    })
    expect(barrelIsPreviewMessage(event)).toBe(true)
  })

  it('barrel parsePreviewData works correctly', () => {
    const event = new MessageEvent('message', {
      data: { type: 'valence:preview-update', data: { slug: 'test' } }
    })
    expect(barrelParsePreviewData(event)).toEqual({ slug: 'test' })
  })
})
