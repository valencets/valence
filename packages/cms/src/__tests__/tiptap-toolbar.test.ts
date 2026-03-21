import { describe, it, expect } from 'vitest'
import { TOOLBAR_ACTIONS } from '../admin/editor/tiptap-entry.js'

describe('Tiptap toolbar actions', () => {
  it('exports TOOLBAR_ACTIONS array', () => {
    expect(Array.isArray(TOOLBAR_ACTIONS)).toBe(true)
  })

  it('has 8 toolbar buttons', () => {
    expect(TOOLBAR_ACTIONS).toHaveLength(8)
  })

  it('includes Bold, Italic, Underline format buttons', () => {
    const labels = TOOLBAR_ACTIONS.map(a => a.label)
    expect(labels).toContain('B')
    expect(labels).toContain('I')
    expect(labels).toContain('U')
  })

  it('includes Heading button', () => {
    const labels = TOOLBAR_ACTIONS.map(a => a.label)
    expect(labels).toContain('H2')
  })

  it('includes list buttons', () => {
    const labels = TOOLBAR_ACTIONS.map(a => a.label)
    expect(labels).toContain('UL')
    expect(labels).toContain('OL')
  })

  it('includes Blockquote button', () => {
    const labels = TOOLBAR_ACTIONS.map(a => a.label)
    expect(labels).toContain('Quote')
  })

  it('includes Code inline button', () => {
    const labels = TOOLBAR_ACTIONS.map(a => a.label)
    expect(labels).toContain('Code')
  })

  it('each action has label and type', () => {
    for (const action of TOOLBAR_ACTIONS) {
      expect(typeof action.label).toBe('string')
      expect(typeof action.type).toBe('string')
    }
  })
})
