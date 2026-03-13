import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING, isMobile } from '../tokens/hud-tokens.js'
import { fetchFleetSites, fetchFleetAggregates, fetchFleetAlerts } from '../data/fetch-fleet.js'
import { formatNumber } from '../data/format-number.js'

const ALERT_BG: Record<string, string> = {
  red: 'hsla(0, 70%, 40%, 0.15)',
  amber: 'hsla(35, 70%, 40%, 0.15)',
  blue: 'hsla(210, 70%, 40%, 0.15)'
}

export class FleetDashboard extends HTMLElement {
  private _initialized = false
  private _totalMetric: HTMLElement | null = null
  private _healthyMetric: HTMLElement | null = null
  private _offlineMetric: HTMLElement | null = null
  private _sessionsMetric: HTMLElement | null = null
  private _conversionsMetric: HTMLElement | null = null
  private _periodChangeHandler: ((e: Event) => void) | null = null
  private _alertsContainer: HTMLElement | null = null
  private _headerEl: HTMLElement | null = null
  private _summaryGrid: HTMLElement | null = null
  private _tableWrapper: HTMLElement | null = null
  private _resizeHandler: (() => void) | null = null

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

    // Alerts container (populated from API)
    const alertsContainer = document.createElement('div')
    alertsContainer.setAttribute('data-alerts', '')
    alertsContainer.style.marginBottom = HUD_SPACING.md

    // Wrap table in scroll container for mobile
    const tableWrapper = document.createElement('div')
    tableWrapper.appendChild(sitesTable)

    this.appendChild(header)
    this.appendChild(grid)
    this.appendChild(alertsContainer)
    this.appendChild(tableHeader)
    this.appendChild(tableWrapper)

    this._totalMetric = totalMetric
    this._healthyMetric = healthyMetric
    this._offlineMetric = offlineMetric
    this._sessionsMetric = sessionsMetric
    this._conversionsMetric = conversionsMetric
    this._alertsContainer = alertsContainer
    this._headerEl = header
    this._summaryGrid = grid
    this._tableWrapper = tableWrapper

    // Responsive layout
    this._resizeHandler = () => this._applyResponsive()
    window.addEventListener('resize', this._resizeHandler)
    this._applyResponsive()

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
        window.location.href = `/admin/hud?site=${siteId}`
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
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler)
    }
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  private _applyResponsive (): void {
    const mobile = isMobile()
    this.style.padding = mobile ? HUD_SPACING.md : HUD_SPACING.lg

    if (this._headerEl !== null) {
      this._headerEl.style.flexDirection = mobile ? 'column' : 'row'
      this._headerEl.style.gap = mobile ? HUD_SPACING.sm : '0'
      this._headerEl.style.alignItems = mobile ? 'flex-start' : 'center'
    }
    if (this._summaryGrid !== null) {
      this._summaryGrid.style.gridTemplateColumns = mobile ? '1fr 1fr' : 'repeat(5, 1fr)'
    }
    if (this._tableWrapper !== null) {
      this._tableWrapper.style.overflowX = mobile ? 'auto' : ''
    }
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

    fetchFleetAlerts('').match(
      (alerts) => {
        if (this._alertsContainer === null) return
        // Clear previous alerts
        this._alertsContainer.innerHTML = ''
        for (const alert of alerts) {
          const row = document.createElement('div')
          row.setAttribute('data-alert', '')
          row.style.padding = `${HUD_SPACING.sm} ${HUD_SPACING.md}`
          row.style.marginBottom = HUD_SPACING.xs
          row.style.borderRadius = '4px'
          row.style.fontSize = HUD_TYPOGRAPHY.scale.sm
          row.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
          row.style.backgroundColor = ALERT_BG[alert.severity] ?? HUD_COLORS.surface
          row.style.color = HUD_COLORS.textPrimary
          row.textContent = alert.message
          this._alertsContainer.appendChild(row)
        }
      },
      () => {} // Hold placeholders on error
    )
  }
}

customElements.define('hud-fleet-dashboard', FleetDashboard)
