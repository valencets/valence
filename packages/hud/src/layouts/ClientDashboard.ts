import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING, isMobile } from '../tokens/hud-tokens.js'
import { fetchSessionSummary, fetchEventSummary, fetchConversionSummary } from '../data/fetch-summaries.js'
import { fetchTopPages, fetchTrafficSources, fetchLeadActions } from '../data/fetch-breakdowns.js'
import type { HudPeriod } from '../types.js'
import { formatNumber } from '../data/format-number.js'

const LEAD_ACTION_LABELS: Record<string, string> = {
  LEAD_PHONE: 'Phone',
  LEAD_EMAIL: 'Email',
  LEAD_FORM: 'Form'
}

function readSiteParam (): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('site') ?? ''
}

export class ClientDashboard extends HTMLElement {
  private _initialized = false
  private _siteParam = ''
  private _visitorsMetric: HTMLElement | null = null
  private _leadsMetric: HTMLElement | null = null
  private _topPagesTable: HTMLElement | null = null
  private _actionsPanel: HTMLElement | null = null
  private _sourcesPanel: HTMLElement | null = null
  private _periodChangeHandler: ((e: Event) => void) | null = null
  private _headerEl: HTMLElement | null = null
  private _gridEl: HTMLElement | null = null
  private _bottomGridEl: HTMLElement | null = null
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
    title.textContent = 'INERTIA HUD'

    const timerange = document.createElement('hud-timerange')
    timerange.setAttribute('period', '7D')

    header.appendChild(title)
    header.appendChild(timerange)

    // Grid layout
    const grid = document.createElement('div')
    grid.style.display = 'grid'
    grid.style.gridTemplateColumns = '1fr 1fr 1fr'
    grid.style.gap = HUD_SPACING.md

    // Panel 1: Visitors
    const visitorsPanel = document.createElement('hud-panel')
    visitorsPanel.setAttribute('label', 'Visitors')
    const visitorsMetric = document.createElement('hud-metric')
    visitorsMetric.setAttribute('value', '--')
    visitorsMetric.setAttribute('delta', '')
    visitorsMetric.setAttribute('delta-direction', 'flat')
    visitorsPanel.appendChild(visitorsMetric)

    // Panel 2: Leads
    const leadsPanel = document.createElement('hud-panel')
    leadsPanel.setAttribute('label', 'Leads')
    const leadsMetric = document.createElement('hud-metric')
    leadsMetric.setAttribute('value', '--')
    leadsMetric.setAttribute('delta', '')
    leadsMetric.setAttribute('delta-direction', 'flat')
    leadsPanel.appendChild(leadsMetric)

    // Panel 3: Top Pages
    const topPagesPanel = document.createElement('hud-panel')
    topPagesPanel.setAttribute('label', 'Top Pages')
    const topPagesTable = document.createElement('hud-table')
    topPagesTable.setAttribute('columns', JSON.stringify([
      { label: 'Page', key: 'path', align: 'left' },
      { label: 'Views', key: 'count', align: 'right', numeric: true }
    ]))
    topPagesTable.setAttribute('rows', '[]')
    topPagesPanel.appendChild(topPagesTable)

    // Panel 4: Lead Actions (bars created dynamically from API response)
    const actionsPanel = document.createElement('hud-panel')
    actionsPanel.setAttribute('label', 'Lead Actions')
    const actionsPlaceholder = document.createElement('hud-bar')
    actionsPlaceholder.setAttribute('label', 'Loading')
    actionsPlaceholder.setAttribute('value', '--')
    actionsPlaceholder.setAttribute('percent', '0')
    actionsPanel.appendChild(actionsPlaceholder)

    // Panel 5: Traffic Sources
    const sourcesPanel = document.createElement('hud-panel')
    sourcesPanel.setAttribute('label', 'Traffic Sources')
    const sourceCategories = ['Search', 'Direct', 'Social', 'Other']
    for (const cat of sourceCategories) {
      const bar = document.createElement('hud-bar')
      bar.setAttribute('label', cat)
      bar.setAttribute('value', '--')
      bar.setAttribute('percent', '0')
      sourcesPanel.appendChild(bar)
    }

    grid.appendChild(visitorsPanel)
    grid.appendChild(leadsPanel)
    grid.appendChild(topPagesPanel)

    // Bottom row spans 2 columns
    const bottomGrid = document.createElement('div')
    bottomGrid.style.display = 'grid'
    bottomGrid.style.gridTemplateColumns = '1fr 1fr'
    bottomGrid.style.gap = HUD_SPACING.md
    bottomGrid.style.marginTop = HUD_SPACING.md

    bottomGrid.appendChild(actionsPanel)
    bottomGrid.appendChild(sourcesPanel)

    this.appendChild(header)
    this.appendChild(grid)
    this.appendChild(bottomGrid)

    // Store references for data updates and responsive layout
    this._visitorsMetric = visitorsMetric
    this._leadsMetric = leadsMetric
    this._topPagesTable = topPagesTable
    this._actionsPanel = actionsPanel
    this._sourcesPanel = sourcesPanel
    this._headerEl = header
    this._gridEl = grid
    this._bottomGridEl = bottomGrid

    // Responsive layout
    this._resizeHandler = () => this._applyResponsive()
    window.addEventListener('resize', this._resizeHandler)
    this._applyResponsive()

    // Listen for period changes
    this._periodChangeHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { period: string }
      this.refreshData(detail.period as HudPeriod)
    }
    this.addEventListener('hud-period-change', this._periodChangeHandler)

    // Read site param from URL for drill-down context
    this._siteParam = readSiteParam()

    // Initial data fetch
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
    if (this._gridEl !== null) {
      this._gridEl.style.gridTemplateColumns = mobile ? '1fr' : '1fr 1fr 1fr'
    }
    if (this._bottomGridEl !== null) {
      this._bottomGridEl.style.gridTemplateColumns = mobile ? '1fr' : '1fr 1fr'
    }
  }

  private refreshData (period: HudPeriod): void {
    const site = this._siteParam || undefined

    fetchSessionSummary('', period, site).match(
      (data) => {
        if (this._visitorsMetric && typeof data.total_sessions === 'number') {
          this._visitorsMetric.setAttribute('value', formatNumber(data.total_sessions))
        }
      },
      () => {} // Hold placeholders on error
    )

    fetchEventSummary('', period, site).match(
      (data) => {
        if (this._leadsMetric && typeof data.total_count === 'number') {
          this._leadsMetric.setAttribute('value', formatNumber(data.total_count))
        }
      },
      () => {} // Hold placeholders on error
    )

    fetchConversionSummary('', period, site).match(
      () => {},
      () => {} // Hold placeholders on error
    )

    fetchTopPages('', period, site).match(
      (data) => {
        if (this._topPagesTable && Array.isArray(data.pages)) {
          this._topPagesTable.setAttribute('rows', JSON.stringify(data.pages))
        }
      },
      () => {} // Hold placeholders on error
    )

    fetchTrafficSources('', period, site).match(
      (data) => {
        if (this._sourcesPanel && Array.isArray(data.sources)) {
          this._updateBars(this._sourcesPanel, data.sources.map(s => ({
            label: s.category,
            value: String(s.count),
            percent: String(s.percent)
          })))
        }
      },
      () => {} // Hold placeholders on error
    )

    fetchLeadActions('', period, site).match(
      (data) => {
        if (this._actionsPanel && Array.isArray(data.actions)) {
          const total = data.actions.reduce((sum, x) => sum + x.count, 0)
          this._updateBars(this._actionsPanel, data.actions.map(a => ({
            label: LEAD_ACTION_LABELS[a.action] ?? a.action,
            value: String(a.count),
            percent: String(total > 0 ? Math.round((a.count / total) * 100) : 0)
          })))
        }
      },
      () => {} // Hold placeholders on error
    )
  }

  private _updateBars (panel: HTMLElement, items: ReadonlyArray<{ label: string; value: string; percent: string }>): void {
    // Clear existing bars and rebuild from data
    const existing = panel.querySelectorAll('hud-bar')
    for (const bar of existing) bar.remove()

    for (const item of items) {
      const bar = document.createElement('hud-bar')
      bar.setAttribute('label', item.label)
      bar.setAttribute('value', item.value)
      bar.setAttribute('percent', item.percent)
      panel.appendChild(bar)
    }
  }
}

customElements.define('hud-client-dashboard', ClientDashboard)
