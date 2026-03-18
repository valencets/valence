import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ValTable } from '../components/val-table.js'
import { defineTestElement } from './test-helpers.js'

describe('ValTable', () => {
  let container: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
  })

  afterEach(() => {
    container.remove()
  })

  function create (attrs?: Record<string, string>): InstanceType<typeof ValTable> {
    const tag = defineTestElement('val-table', ValTable)
    const el = document.createElement(tag) as InstanceType<typeof ValTable>
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    }
    container.appendChild(el)
    return el
  }

  function withData (el: InstanceType<typeof ValTable>) {
    el.columns = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', sortable: true }
    ]
    el.rows = [
      { name: 'Alice', email: 'alice@example.com', role: 'Admin' },
      { name: 'Bob', email: 'bob@example.com', role: 'Editor' },
      { name: 'Carol', email: 'carol@example.com', role: 'Viewer' }
    ]
  }

  describe('DOM structure', () => {
    it('is light DOM', () => {
      const el = create()
      expect(el.shadowRoot).toBeNull()
    })

    it('renders a table element on connect', () => {
      const el = create()
      withData(el)
      expect(el.querySelector('table')).not.toBeNull()
    })

    it('has role=grid', () => {
      const el = create()
      withData(el)
      const table = el.querySelector('table')!
      expect(table.getAttribute('role')).toBe('grid')
    })
  })

  describe('columns and rows', () => {
    it('renders column headers', () => {
      const el = create()
      withData(el)
      const headers = el.querySelectorAll('th')
      expect(headers.length).toBe(3)
      expect(headers[0]!.textContent).toBe('Name')
      expect(headers[1]!.textContent).toBe('Email')
      expect(headers[2]!.textContent).toBe('Role')
    })

    it('renders data rows', () => {
      const el = create()
      withData(el)
      const rows = el.querySelectorAll('tbody tr')
      expect(rows.length).toBe(3)
      const cells = rows[0]!.querySelectorAll('td')
      expect(cells[0]!.textContent).toBe('Alice')
      expect(cells[1]!.textContent).toBe('alice@example.com')
    })

    it('re-renders when columns change', () => {
      const el = create()
      withData(el)
      el.columns = [{ key: 'name', label: 'Full Name' }]
      const headers = el.querySelectorAll('th')
      expect(headers.length).toBe(1)
      expect(headers[0]!.textContent).toBe('Full Name')
    })

    it('re-renders when rows change', () => {
      const el = create()
      withData(el)
      el.rows = [{ name: 'Dave', email: 'd@e.com', role: 'Admin' }]
      const rows = el.querySelectorAll('tbody tr')
      expect(rows.length).toBe(1)
    })
  })

  describe('sorting', () => {
    it('marks sortable columns with aria-sort', () => {
      const el = create()
      withData(el)
      const headers = el.querySelectorAll('th')
      expect(headers[0]!.hasAttribute('aria-sort')).toBe(false)
      expect(headers[2]!.getAttribute('aria-sort')).toBe('none')
    })

    it('sorts ascending on click', () => {
      const el = create()
      withData(el)
      el.querySelectorAll('th')[2]!.click()
      // Re-query after render — click rebuilds the table
      expect(el.querySelectorAll('th')[2]!.getAttribute('aria-sort')).toBe('ascending')
      const firstCell = el.querySelector('tbody tr td:nth-child(3)')!
      expect(firstCell.textContent).toBe('Admin')
    })

    it('toggles to descending on second click', () => {
      const el = create()
      withData(el)
      el.querySelectorAll('th')[2]!.click()
      el.querySelectorAll('th')[2]!.click()
      expect(el.querySelectorAll('th')[2]!.getAttribute('aria-sort')).toBe('descending')
      const firstCell = el.querySelector('tbody tr td:nth-child(3)')!
      expect(firstCell.textContent).toBe('Viewer')
    })

    it('emits val:interaction on sort', () => {
      const el = create()
      withData(el)
      const listener = vi.fn()
      el.addEventListener('val:interaction', listener)

      el.querySelectorAll('th')[2]!.click()

      expect(listener).toHaveBeenCalledOnce()
      const detail = (listener.mock.calls[0]![0] as CustomEvent).detail
      expect(detail.action).toBe('sort')
      expect(detail.column).toBe('role')
      expect(detail.direction).toBe('ascending')
    })
  })

  describe('CMS traceability', () => {
    it('reads data-cms-id', () => {
      const el = create({ 'data-cms-id': 'users-table' })
      expect(el.cmsId).toBe('users-table')
    })
  })
})
