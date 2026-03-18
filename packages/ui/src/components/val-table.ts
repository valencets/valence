import { ValElement } from '../core/val-element.js'

export interface ValTableColumn {
  key: string
  label: string
  sortable?: boolean
}

export type ValTableRow = Record<string, string | number | boolean>

type SortDirection = 'ascending' | 'descending' | 'none'

export class ValTable extends ValElement {
  private _columns: ValTableColumn[] = []
  private _rows: ValTableRow[] = []
  private sortKey: string | null = null
  private sortDirection: SortDirection = 'none'
  private initialized = false

  constructor () {
    super({ shadow: false })
  }

  protected createTemplate (): HTMLTemplateElement {
    return document.createElement('template')
  }

  get columns (): ValTableColumn[] {
    return this._columns
  }

  set columns (cols: ValTableColumn[]) {
    this._columns = cols
    this.render()
  }

  get rows (): ValTableRow[] {
    return this._rows
  }

  set rows (data: ValTableRow[]) {
    this._rows = data
    this.render()
  }

  connectedCallback (): void {
    super.connectedCallback()
    if (!this.initialized) {
      this.style.display = 'block'
      this.style.fontFamily = 'var(--val-font-sans)'
      this.style.fontSize = 'var(--val-text-sm)'
      this.style.color = 'var(--val-color-text)'
      this.initialized = true
    }
    this.render()
  }

  private render (): void {
    // Only render if connected
    if (!this.isConnected) return

    // Clear existing table
    const existing = this.querySelector('table')
    if (existing !== null) existing.remove()

    if (this._columns.length === 0) return

    const table = document.createElement('table')
    table.setAttribute('role', 'grid')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'

    // Header
    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    for (const col of this._columns) {
      const th = document.createElement('th')
      th.textContent = col.label
      th.style.textAlign = 'left'
      th.style.padding = 'var(--val-space-2) var(--val-space-3)'
      th.style.borderBottom = '2px solid var(--val-color-border)'
      th.style.fontWeight = 'var(--val-weight-semibold)'

      if (col.sortable === true) {
        th.style.cursor = 'pointer'
        th.style.userSelect = 'none'
        const currentSort = this.sortKey === col.key ? this.sortDirection : 'none'
        th.setAttribute('aria-sort', currentSort)
        th.addEventListener('click', () => this.handleSort(col.key))
      }

      headerRow.appendChild(th)
    }
    thead.appendChild(headerRow)
    table.appendChild(thead)

    // Body
    const sorted = this.getSortedRows()
    const tbody = document.createElement('tbody')
    for (const row of sorted) {
      const tr = document.createElement('tr')
      for (const col of this._columns) {
        const td = document.createElement('td')
        td.textContent = String(row[col.key] ?? '')
        td.style.padding = 'var(--val-space-2) var(--val-space-3)'
        td.style.borderBottom = '1px solid var(--val-color-border)'
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    this.appendChild(table)
  }

  private getSortedRows (): ValTableRow[] {
    if (this.sortKey === null || this.sortDirection === 'none') {
      return [...this._rows]
    }
    const key = this.sortKey
    const dir = this.sortDirection === 'ascending' ? 1 : -1
    return [...this._rows].sort((a, b) => {
      const aVal = String(a[key] ?? '')
      const bVal = String(b[key] ?? '')
      return aVal.localeCompare(bVal) * dir
    })
  }

  private handleSort (key: string): void {
    if (this.sortKey === key) {
      this.sortDirection = this.sortDirection === 'ascending' ? 'descending' : 'ascending'
    } else {
      this.sortKey = key
      this.sortDirection = 'ascending'
    }
    this.render()
    this.emitInteraction('sort', { column: key, direction: this.sortDirection })
  }
}

customElements.define('val-table', ValTable)
