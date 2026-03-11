import { describe, it, expect } from 'vitest'
import { transformIntentToEvent, transformIntentsToEvents } from '../transform.js'
import type { ValidatedIntent } from '../schemas.js'

const sampleIntent: ValidatedIntent = {
  id: 'evt-001',
  timestamp: 1709280000000,
  type: 'CLICK',
  targetDOMNode: '#cta-hero',
  x_coord: 512,
  y_coord: 300
}

const sessionId = 'session-abc-123'

describe('transformIntentToEvent', () => {
  it('maps type to event_category', () => {
    const result = transformIntentToEvent(sampleIntent, sessionId)
    expect(result.event_category).toBe('CLICK')
  })

  it('maps targetDOMNode to dom_target', () => {
    const result = transformIntentToEvent(sampleIntent, sessionId)
    expect(result.dom_target).toBe('#cta-hero')
  })

  it('attaches session_id', () => {
    const result = transformIntentToEvent(sampleIntent, sessionId)
    expect(result.session_id).toBe(sessionId)
  })

  it('puts coordinates and metadata into payload', () => {
    const result = transformIntentToEvent(sampleIntent, sessionId)
    expect(result.payload).toEqual({
      id: 'evt-001',
      timestamp: 1709280000000,
      x_coord: 512,
      y_coord: 300
    })
  })

  it('maps empty targetDOMNode to null', () => {
    const intent: ValidatedIntent = { ...sampleIntent, targetDOMNode: '' }
    const result = transformIntentToEvent(intent, sessionId)
    expect(result.dom_target).toBeNull()
  })

  it('handles all intent types', () => {
    const types = ['CLICK', 'SCROLL', 'VIEWPORT_INTERSECT', 'FORM_INPUT', 'INTENT_NAVIGATE', 'INTENT_CALL', 'INTENT_BOOK'] as const
    for (const type of types) {
      const intent: ValidatedIntent = { ...sampleIntent, type }
      const result = transformIntentToEvent(intent, sessionId)
      expect(result.event_category).toBe(type)
    }
  })
})

describe('transformIntentsToEvents', () => {
  it('transforms empty array', () => {
    const result = transformIntentsToEvents([], sessionId)
    expect(result).toEqual([])
  })

  it('transforms multiple intents', () => {
    const intents: ReadonlyArray<ValidatedIntent> = [
      sampleIntent,
      { ...sampleIntent, id: 'evt-002', type: 'SCROLL', targetDOMNode: '#section-2' }
    ]
    const result = transformIntentsToEvents(intents, sessionId)
    expect(result).toHaveLength(2)
    expect(result[0]!.event_category).toBe('CLICK')
    expect(result[1]!.event_category).toBe('SCROLL')
  })

  it('all events share the same session_id', () => {
    const intents: ReadonlyArray<ValidatedIntent> = [
      sampleIntent,
      { ...sampleIntent, id: 'evt-002' }
    ]
    const result = transformIntentsToEvents(intents, sessionId)
    for (const event of result) {
      expect(event.session_id).toBe(sessionId)
    }
  })
})
