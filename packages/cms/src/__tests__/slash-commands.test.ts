// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'

describe('slash commands module exports', () => {
  it('exports SLASH_COMMANDS constant', async () => {
    const mod = await import('../admin/editor/slash-commands.js')
    expect(Array.isArray(mod.SLASH_COMMANDS)).toBe(true)
  })

  it('SLASH_COMMANDS has expected built-in commands', async () => {
    const { SLASH_COMMANDS } = await import('../admin/editor/slash-commands.js')
    const ids = SLASH_COMMANDS.map((c: { id: string }) => c.id)
    expect(ids).toContain('heading-2')
    expect(ids).toContain('heading-3')
    expect(ids).toContain('quote')
    expect(ids).toContain('code-block')
    expect(ids).toContain('divider')
    expect(ids).toContain('bullet-list')
    expect(ids).toContain('ordered-list')
  })

  it('each command has id, label, and description fields', async () => {
    const { SLASH_COMMANDS } = await import('../admin/editor/slash-commands.js')
    for (const cmd of SLASH_COMMANDS) {
      expect(typeof cmd.id).toBe('string')
      expect(typeof cmd.label).toBe('string')
      expect(typeof cmd.description).toBe('string')
    }
  })

  it('exports filterCommands function', async () => {
    const mod = await import('../admin/editor/slash-commands.js')
    expect(typeof mod.filterCommands).toBe('function')
  })

  it('exports createSlashMenu function', async () => {
    const mod = await import('../admin/editor/slash-commands.js')
    expect(typeof mod.createSlashMenu).toBe('function')
  })
})

describe('filterCommands()', () => {
  it('returns all commands when query is empty', async () => {
    const { SLASH_COMMANDS, filterCommands } = await import('../admin/editor/slash-commands.js')
    const result = filterCommands(SLASH_COMMANDS, '')
    expect(result).toHaveLength(SLASH_COMMANDS.length)
  })

  it('filters by label prefix (case insensitive)', async () => {
    const { SLASH_COMMANDS, filterCommands } = await import('../admin/editor/slash-commands.js')
    const result = filterCommands(SLASH_COMMANDS, 'head')
    expect(result.length).toBeGreaterThan(0)
    expect(result.every((c: { label: string }) => c.label.toLowerCase().includes('head'))).toBe(true)
  })

  it('returns empty array when no commands match', async () => {
    const { SLASH_COMMANDS, filterCommands } = await import('../admin/editor/slash-commands.js')
    const result = filterCommands(SLASH_COMMANDS, 'xyznonexistent')
    expect(result).toHaveLength(0)
  })

  it('matches "quo" to quote command', async () => {
    const { SLASH_COMMANDS, filterCommands } = await import('../admin/editor/slash-commands.js')
    const result = filterCommands(SLASH_COMMANDS, 'quo')
    expect(result.some((c: { id: string }) => c.id === 'quote')).toBe(true)
  })

  it('matches "ima" to image command if present', async () => {
    const { SLASH_COMMANDS, filterCommands } = await import('../admin/editor/slash-commands.js')
    const result = filterCommands(SLASH_COMMANDS, 'ima')
    // Image may or may not be included, but if it is, it should match
    const imageCmd = SLASH_COMMANDS.find((c: { id: string }) => c.id === 'image')
    if (imageCmd) {
      expect(result.some((c: { id: string }) => c.id === 'image')).toBe(true)
    }
  })
})

describe('createSlashMenu()', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('returns a div element', async () => {
    const { SLASH_COMMANDS, createSlashMenu } = await import('../admin/editor/slash-commands.js')
    const el = createSlashMenu(SLASH_COMMANDS, () => {})
    expect(el.tagName).toBe('DIV')
  })

  it('has slash-menu class', async () => {
    const { SLASH_COMMANDS, createSlashMenu } = await import('../admin/editor/slash-commands.js')
    const el = createSlashMenu(SLASH_COMMANDS, () => {})
    expect(el.className).toContain('slash-menu')
  })

  it('renders a menu item for each command', async () => {
    const { SLASH_COMMANDS, createSlashMenu } = await import('../admin/editor/slash-commands.js')
    const el = createSlashMenu(SLASH_COMMANDS, () => {})
    const items = el.querySelectorAll('.slash-menu-item')
    expect(items.length).toBe(SLASH_COMMANDS.length)
  })

  it('calls onSelect with command id when item is clicked', async () => {
    const { SLASH_COMMANDS, createSlashMenu } = await import('../admin/editor/slash-commands.js')
    const selected: string[] = []
    const el = createSlashMenu(SLASH_COMMANDS, (id: string) => { selected.push(id) })
    document.body.appendChild(el)
    const firstItem = el.querySelector<HTMLElement>('.slash-menu-item')!
    firstItem.click()
    expect(selected).toHaveLength(1)
    expect(typeof selected[0]).toBe('string')
  })

  it('has data-command attribute on each item', async () => {
    const { SLASH_COMMANDS, createSlashMenu } = await import('../admin/editor/slash-commands.js')
    const el = createSlashMenu(SLASH_COMMANDS, () => {})
    const items = el.querySelectorAll<HTMLElement>('.slash-menu-item')
    for (const item of items) {
      expect(item.dataset['command']).toBeTruthy()
    }
  })

  it('shows command labels in menu items', async () => {
    const { SLASH_COMMANDS, createSlashMenu } = await import('../admin/editor/slash-commands.js')
    const el = createSlashMenu(SLASH_COMMANDS, () => {})
    const text = el.textContent ?? ''
    expect(text).toContain('Heading 2')
    expect(text).toContain('Quote')
  })
})
