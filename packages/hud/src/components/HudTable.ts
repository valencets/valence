import { fromThrowable } from 'neverthrow'
import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'

const parseJson = fromThrowable(JSON.parse)

export interface HudColumnDef {
  readonly label: string
  readonly key: string
  readonly align?: 'left' | 'right'
  readonly numeric?: boolean
}

const DEFAULT_MAX_ROWS = 5

export class HudTable extends HTMLElement {
  static observedAttributes = ['columns', 'rows', 'max-rows']

  private _initialized = false
  private thead: HTMLTableSectionElement | null = null
  private tbody: HTMLTableSectionElement | null = null
  private _domAllocated = false

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.setAttribute('role', 'grid')

    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    table.style.fontSize = HUD_TYPOGRAPHY.scale.sm
    table.style.lineHeight = '1.4'

    this.thead = document.createElement('thead')
    this.tbody = document.createElement('tbody')

    table.appendChild(this.thead)
    table.appendChild(this.tbody)
    this.appendChild(table)

    this.allocateDom()
    this.updateData()
  }

  disconnectedCallback (): void {
    // Intentional no-op
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _old: string | null, _value: string | null): void {
    if (!this._initialized) return

    const handlers: Record<string, () => void> = {
      columns: () => {
        this.allocateDom()
        this.updateData()
      },
      'max-rows': () => {
        this.allocateDom()
        this.updateData()
      },
      rows: () => this.updateData()
    }
    handlers[name]?.()
  }

  private getMaxRows (): number {
    const attr = this.getAttribute('max-rows')
    if (attr === null) return DEFAULT_MAX_ROWS
    const parsed = parseInt(attr, 10)
    return isNaN(parsed) ? DEFAULT_MAX_ROWS : parsed
  }

  private getColumns (): ReadonlyArray<HudColumnDef> {
    const raw = this.getAttribute('columns')
    if (raw === null) return []
    const result = parseJson(raw)
    if (result.isErr()) return []
    if (!Array.isArray(result.value)) return []
    return result.value as ReadonlyArray<HudColumnDef>
  }

  private getRows (): ReadonlyArray<Record<string, string | number>> {
    const raw = this.getAttribute('rows')
    if (raw === null) return []
    const result = parseJson(raw)
    if (result.isErr()) return []
    if (!Array.isArray(result.value)) return []
    return (result.value as ReadonlyArray<Record<string, string | number>>).slice(0, this.getMaxRows())
  }

  private allocateDom (): void {
    if (this.thead === null || this.tbody === null) return

    this.thead.innerHTML = ''
    this.tbody.innerHTML = ''
    this._domAllocated = false

    const columns = this.getColumns()
    if (columns.length === 0) return

    // Pre-allocate header
    const trHead = document.createElement('tr')
    for (const col of columns) {
      const th = document.createElement('th')
      th.textContent = col.label
      th.style.textAlign = col.align ?? 'left'
      th.style.color = HUD_COLORS.textSecondary
      th.style.fontWeight = 'normal'
      th.style.fontSize = HUD_TYPOGRAPHY.scale.xs
      th.style.paddingBottom = HUD_SPACING.sm
      th.style.borderBottom = `1px solid ${HUD_COLORS.border}`
      trHead.appendChild(th)
    }
    this.thead.appendChild(trHead)

    // Pre-allocate body rows (padding is applied here, text is left empty)
    const maxRows = this.getMaxRows()
    for (let i = 0; i < maxRows; i++) {
      const tr = document.createElement('tr')

      for (const col of columns) {
        const td = document.createElement('td')
        // Using HUD_SPACING.xs vertically and HUD_SPACING.sm horizontally
        td.style.padding = `${HUD_SPACING.xs} ${HUD_SPACING.sm}`
        td.style.textAlign = col.align ?? 'left'
        td.style.color = HUD_COLORS.textPrimary

        if (col.numeric === true) {
          td.style.fontFamily = HUD_TYPOGRAPHY.fontMono
          td.style.fontVariantNumeric = 'tabular-nums'
        }

        tr.appendChild(td)
      }
      this.tbody.appendChild(tr)
    }

    this._domAllocated = true
  }

  private updateData (): void {
    if (this.tbody === null || !this._domAllocated) return

    const columns = this.getColumns()
    const rows = this.getRows()
    const trs = this.tbody.children

    for (let i = 0; i < trs.length; i++) {
      const tr = trs[i]
      if (tr === undefined) continue

      const rowData = rows[i]
      const tds = tr.children

      for (let j = 0; j < columns.length; j++) {
        const td = tds[j]
        const col = columns[j]
        if (td === undefined || col === undefined) continue

        td.textContent = rowData !== undefined ? String(rowData[col.key] ?? '') : ''
      }
    }
  }
}

customElements.define('hud-table', HudTable)
