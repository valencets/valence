import { fromThrowable } from 'neverthrow'
import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'

const parseJson = fromThrowable(JSON.parse)

export interface HudColumnDef {
  readonly label: string
  readonly key: string
  readonly align?: 'left' | 'right'
  readonly numeric?: boolean
}

const MAX_ROWS = 5

export class HudTable extends HTMLElement {
  static observedAttributes = ['columns', 'rows']

  private _initialized = false
  private thead: HTMLTableSectionElement | null = null
  private tbody: HTMLTableSectionElement | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.setAttribute('role', 'grid')

    const table = document.createElement('table')
    table.style.width = '100%'
    table.style.borderCollapse = 'collapse'
    table.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    table.style.fontSize = HUD_TYPOGRAPHY.scale.sm

    this.thead = document.createElement('thead')
    this.tbody = document.createElement('tbody')

    table.appendChild(this.thead)
    table.appendChild(this.tbody)
    this.appendChild(table)

    this.renderHeaders()
    this.renderRows()
  }

  disconnectedCallback (): void {
    // Intentional no-op
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _old: string | null, _value: string | null): void {
    const handlers: Record<string, () => void> = {
      columns: () => this.renderHeaders(),
      rows: () => this.renderRows()
    }
    handlers[name]?.()
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
    return (result.value as ReadonlyArray<Record<string, string | number>>).slice(0, MAX_ROWS)
  }

  private renderHeaders (): void {
    if (this.thead === null) return
    this.thead.innerHTML = ''

    const columns = this.getColumns()
    if (columns.length === 0) return

    const tr = document.createElement('tr')
    for (const col of columns) {
      const th = document.createElement('th')
      th.textContent = col.label
      th.style.textAlign = col.align ?? 'left'
      th.style.color = HUD_COLORS.textSecondary
      th.style.fontWeight = 'normal'
      th.style.fontSize = HUD_TYPOGRAPHY.scale.xs
      th.style.paddingBottom = HUD_SPACING.sm
      th.style.borderBottom = `1px solid ${HUD_COLORS.border}`
      tr.appendChild(th)
    }
    this.thead.appendChild(tr)
  }

  private renderRows (): void {
    if (this.tbody === null) return
    this.tbody.innerHTML = ''

    const columns = this.getColumns()
    const rows = this.getRows()

    for (let i = 0; i < MAX_ROWS; i++) {
      const tr = document.createElement('tr')
      const row = rows[i]

      for (const col of columns) {
        const td = document.createElement('td')
        td.style.padding = `${HUD_SPACING.xs} 0`
        td.style.textAlign = col.align ?? 'left'
        td.style.color = HUD_COLORS.textPrimary

        if (col.numeric === true) {
          td.style.fontFamily = HUD_TYPOGRAPHY.fontMono
          td.style.fontVariantNumeric = 'tabular-nums'
        }

        td.textContent = row !== undefined ? String(row[col.key] ?? '') : ''
        tr.appendChild(td)
      }
      this.tbody.appendChild(tr)
    }
  }
}

customElements.define('hud-table', HudTable)
