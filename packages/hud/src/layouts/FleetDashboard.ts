import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'
import { fetchFleetSites, fetchFleetAggregates } from '../data/fetch-fleet.js'
import { formatNumber } from '../data/format-number.js'

export class FleetDashboard extends HTMLElement {
  private _initialized = false
  private _totalMetric: HTMLElement | null = null
  private _healthyMetric: HTMLElement | null = null
  private _offlineMetric: HTMLElement | null = null
  private _sessionsMetric: HTMLElement | null = null
  private _conversionsMetric: HTMLElement | null = null
  private _periodChangeHandler: ((e: Event) => void) | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.style.display = 'block'
    this.style.backgroundColor = HUD_COLORS.bg
    this.style.color = HUD_COLORS.textPrimary
    this.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    this.style.padding = HUD_SPACING.lg

    // Header with title and time range
    const header = document.createElement('div')
    header.style.display = 'flex'
    header.style.justifyContent = 'space-between'
    header.style.alignItems = 'center'
    header.style.marginBottom = HUD_SPACING.lg

    const title = document.createElement('span')
    title.style.fontSize = HUD_TYPOGRAPHY.scale.lg
    title.style.fontWeight = '600'
    title.style.color = HUD_COLORS.textPrimary
    title.textContent = 'FLEET OVERVIEW'

    const timerange = document.createElement('hud-timerange')
    timerange.setAttribute('period', '7D')

    header.appendChild(title)
    header.appendChild(timerange)

    // Summary grid — 5 metric panels
    const grid = document.createElement('div')
    grid.style.display = 'grid'
    grid.style.gridTemplateColumns = 'repeat(5, 1fr)'
    grid.style.gap = HUD_SPACING.md
    grid.style.marginBottom = HUD_SPACING.xl

    const totalPanel = document.createElement('hud-panel')
    totalPanel.setAttribute('label', 'Total Sites')
    const totalMetric = document.createElement('hud-metric')
    totalMetric.setAttribute('value', '--')
    totalMetric.setAttribute('label', 'registered')
    totalPanel.appendChild(totalMetric)

    const healthyPanel = document.createElement('hud-panel')
    healthyPanel.setAttribute('label', 'Healthy')
    const healthyMetric = document.createElement('hud-metric')
    healthyMetric.setAttribute('value', '--')
    healthyMetric.setAttribute('label', 'last 24h')
    healthyPanel.appendChild(healthyMetric)

    const offlinePanel = document.createElement('hud-panel')
    offlinePanel.setAttribute('label', 'Offline')
    const offlineMetric = document.createElement('hud-metric')
    offlineMetric.setAttribute('value', '--')
    offlineMetric.setAttribute('label', 'no sync')
    offlinePanel.appendChild(offlineMetric)

    const sessionsPanel = document.createElement('hud-panel')
    sessionsPanel.setAttribute('label', 'Sessions')
    const sessionsMetric = document.createElement('hud-metric')
    sessionsMetric.setAttribute('value', '--')
    sessionsMetric.setAttribute('label', '30 days')
    sessionsPanel.appendChild(sessionsMetric)

    const conversionsPanel = document.createElement('hud-panel')
    conversionsPanel.setAttribute('label', 'Conversions')
    const conversionsMetric = document.createElement('hud-metric')
    conversionsMetric.setAttribute('value', '--')
    conversionsMetric.setAttribute('label', '30 days')
    conversionsPanel.appendChild(conversionsMetric)

    grid.appendChild(totalPanel)
    grid.appendChild(healthyPanel)
    grid.appendChild(offlinePanel)
    grid.appendChild(sessionsPanel)
    grid.appendChild(conversionsPanel)

    // Table section header
    const tableHeader = document.createElement('div')
    tableHeader.style.display = 'flex'
    tableHeader.style.justifyContent = 'space-between'
    tableHeader.style.alignItems = 'baseline'
    tableHeader.style.marginBottom = HUD_SPACING.md
    tableHeader.style.paddingBottom = HUD_SPACING.sm
    tableHeader.style.borderBottom = `1px solid ${HUD_COLORS.border}`

    const tableLabel = document.createElement('span')
    tableLabel.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    tableLabel.style.fontSize = HUD_TYPOGRAPHY.scale.xs
    tableLabel.style.fontWeight = '600'
    tableLabel.style.color = HUD_COLORS.textSecondary
    tableLabel.style.textTransform = 'uppercase'
    tableLabel.style.letterSpacing = '0.05em'
    tableLabel.textContent = 'Active Fleet Sites'

    tableHeader.appendChild(tableLabel)

    // Table — no panel wrapper
    const sitesTable = document.createElement('hud-table')
    sitesTable.setAttribute('max-rows', '50')
    sitesTable.setAttribute('columns', JSON.stringify([
      { label: 'Status', key: 'status', align: 'left' },
      { label: 'Site', key: 'site_id', align: 'left' },
      { label: 'Type', key: 'business_type', align: 'left' },
      { label: 'Sessions', key: 'session_count', align: 'right', numeric: true },
      { label: 'Conversions', key: 'conversion_count', align: 'right', numeric: true },
      { label: 'Last Sync', key: 'last_synced', align: 'right' }
    ]))
    sitesTable.setAttribute('rows', '[]')

    this.appendChild(header)
    this.appendChild(grid)
    this.appendChild(tableHeader)
    this.appendChild(sitesTable)

    this._totalMetric = totalMetric
    this._healthyMetric = healthyMetric
    this._offlineMetric = offlineMetric
    this._sessionsMetric = sessionsMetric
    this._conversionsMetric = conversionsMetric

    // Drill-down: click table row to navigate to site HUD
    sitesTable.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement | null
      if (target === null) return
      const row = target.closest('tr')
      if (row === null || row.closest('thead') !== null) return
      const cells = row.querySelectorAll('td')
      const siteIdCell = cells[1]
      if (siteIdCell === undefined) return
      const siteId = siteIdCell.textContent?.trim() ?? ''
      if (siteId !== '') {
        window.history.pushState({}, '', `/admin/hud?site=${siteId}`)
      }
    })

    // Listen for period changes
    this._periodChangeHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { period: string }
      this.refreshData(detail.period)
    }
    this.addEventListener('hud-period-change', this._periodChangeHandler)

    // Fetch data
    this.refreshData('7D')
  }

  disconnectedCallback (): void {
    if (this._periodChangeHandler) {
      this.removeEventListener('hud-period-change', this._periodChangeHandler)
    }
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  private refreshData (period: string): void {
    fetchFleetSites('', period).match(
      (sites) => {
        const table = this.querySelector('hud-table')
        if (table === null) return

        const rows = sites.map((site) => ({
          status: site.status,
          site_id: site.site_id,
          business_type: site.business_type,
          session_count: site.session_count ?? 0,
          conversion_count: site.conversion_count ?? 0,
          last_synced: site.last_synced ?? '--'
        }))

        table.setAttribute('rows', JSON.stringify(rows))

        // Update summary metrics
        const total = sites.length
        const healthy = sites.filter(s => s.status === 'healthy').length
        const offline = sites.filter(s => s.status === 'offline').length

        if (this._totalMetric !== null) this._totalMetric.setAttribute('value', String(total))
        if (this._healthyMetric !== null) this._healthyMetric.setAttribute('value', String(healthy))
        if (this._offlineMetric !== null) this._offlineMetric.setAttribute('value', String(offline))
      },
      () => {} // Hold placeholders on error
    )

    fetchFleetAggregates('', period).match(
      (agg) => {
        if (this._sessionsMetric !== null) {
          this._sessionsMetric.setAttribute('value', formatNumber(agg.total_sessions))
        }
        if (this._conversionsMetric !== null) {
          this._conversionsMetric.setAttribute('value', formatNumber(agg.total_conversions))
        }
      },
      () => {} // Hold placeholders on error
    )
  }
}

customElements.define('hud-fleet-dashboard', FleetDashboard)
