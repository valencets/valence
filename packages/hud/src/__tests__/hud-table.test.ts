import { describe, it, expect, beforeAll, afterEach } from 'vitest'

beforeAll(async () => {
  if (customElements.get('hud-table') === undefined) {
    await import('../components/HudTable.js')
  }
})

const COLS = JSON.stringify([
  { label: 'Page', key: 'path', align: 'left' },
  { label: 'Views', key: 'count', align: 'right', numeric: true }
])

const ROWS = JSON.stringify([
  { path: '/', count: 412 },
  { path: '/services', count: 289 },
  { path: '/contact', count: 156 }
])

function createElement (attrs?: Record<string, string>): HTMLElement {
  const el = document.createElement('hud-table')
  if (attrs !== undefined) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value)
    }
  }
  return el
}

function attach (el: HTMLElement): HTMLElement {
  document.body.appendChild(el)
  return el
}

describe('HudTable', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('registers as custom element hud-table', () => {
    expect(customElements.get('hud-table')).toBeDefined()
  })

  it('renders a table with thead and tbody', () => {
    const el = attach(createElement({ columns: COLS }))
    expect(el.querySelector('table')).not.toBeNull()
    expect(el.querySelector('thead')).not.toBeNull()
    expect(el.querySelector('tbody')).not.toBeNull()
  })

  it('creates header cells from columns JSON', () => {
    const el = attach(createElement({ columns: COLS }))
    const ths = el.querySelectorAll('th')
    expect(ths.length).toBe(2)
    expect(ths[0]?.textContent).toBe('Page')
    expect(ths[1]?.textContent).toBe('Views')
  })

  it('creates data rows from rows JSON', () => {
    const el = attach(createElement({ columns: COLS, rows: ROWS }))
    const trs = el.querySelectorAll('tbody tr')
    // 5 rows: 3 data + 2 empty padding
    expect(trs.length).toBe(5)
  })

  it('caps at 5 rows maximum', () => {
    const manyRows = JSON.stringify(
      Array.from({ length: 10 }, (_, i) => ({ path: `/page-${String(i)}`, count: i }))
    )
    const el = attach(createElement({ columns: COLS, rows: manyRows }))
    const trs = el.querySelectorAll('tbody tr')
    expect(trs.length).toBe(5)
  })

  it('applies tabular-nums to numeric columns', () => {
    const el = attach(createElement({ columns: COLS, rows: ROWS }))
    const tds = el.querySelectorAll('tbody td')
    // Second column (index 1) is numeric
    const numericTd = tds[1]
    expect(numericTd?.style.fontVariantNumeric).toBe('tabular-nums')
  })

  it('pads with empty rows when fewer than 5', () => {
    const oneRow = JSON.stringify([{ path: '/', count: 100 }])
    const el = attach(createElement({ columns: COLS, rows: oneRow }))
    const trs = el.querySelectorAll('tbody tr')
    expect(trs.length).toBe(5)
    // Last row should have empty cells
    const lastRowTds = trs[4]?.querySelectorAll('td')
    expect(lastRowTds?.[0]?.textContent).toBe('')
  })

  it('rebuilds tbody on rows update', () => {
    const el = attach(createElement({ columns: COLS, rows: ROWS }))
    const firstCellBefore = el.querySelector('tbody td')?.textContent

    const newRows = JSON.stringify([{ path: '/new', count: 999 }])
    el.setAttribute('rows', newRows)
    const firstCellAfter = el.querySelector('tbody td')?.textContent
    expect(firstCellAfter).toBe('/new')
    expect(firstCellAfter).not.toBe(firstCellBefore)
  })

  it('has role="grid"', () => {
    const el = attach(createElement({ columns: COLS }))
    expect(el.getAttribute('role')).toBe('grid')
  })

  it('renders correct cell text content', () => {
    const el = attach(createElement({ columns: COLS, rows: ROWS }))
    const firstRow = el.querySelector('tbody tr')
    const tds = firstRow?.querySelectorAll('td')
    expect(tds?.[0]?.textContent).toBe('/')
    expect(tds?.[1]?.textContent).toBe('412')
  })

  it('has connectedMoveCallback defined', () => {
    const el = createElement()
    expect(typeof (el as unknown as { connectedMoveCallback: unknown }).connectedMoveCallback).toBe('function')
  })

  it('mutates DOM in-place on rows update without re-creating elements', () => {
    const el = attach(createElement({ columns: COLS, rows: ROWS }))
    const firstRowBefore = el.querySelector('tbody tr')
    expect(firstRowBefore).not.toBeNull()

    // Update rows with new data
    const newRows = JSON.stringify([{ path: '/updated', count: 999 }])
    el.setAttribute('rows', newRows)

    const firstRowAfter = el.querySelector('tbody tr')
    // The TR element instance must be exactly the same (mutated in place)
    expect(firstRowAfter).toBe(firstRowBefore)
  })

  it('handles empty columns gracefully', () => {
    const el = attach(createElement())
    expect(el.querySelectorAll('th').length).toBe(0)
  })

  it('returns empty table on malformed columns JSON', () => {
    const el = attach(createElement({ columns: '{bad json', rows: '[]' }))
    const headers = el.querySelectorAll('th')
    expect(headers.length).toBe(0)
  })

  it('returns empty tbody on malformed rows JSON', () => {
    const cols = JSON.stringify([{ label: 'Name', key: 'name' }])
    const el = attach(createElement({ columns: cols, rows: '{bad json' }))
    expect(el.querySelector('table')).not.toBeNull()
    // No crash — rows fallback to empty, so all cells are empty
    const tds = el.querySelectorAll('tbody tr td')
    for (const td of tds) {
      expect(td.textContent).toBe('')
    }
  })
})
