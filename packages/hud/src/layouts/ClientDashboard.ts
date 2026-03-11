import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'
import { fetchSessionSummary, fetchEventSummary, fetchConversionSummary } from '../data/fetch-summaries.js'
import type { HudPeriod } from '../types.js'
import { formatNumber } from '../data/format-number.js'

export class ClientDashboard extends HTMLElement {
  private _initialized = false
  private _visitorsMetric: HTMLElement | null = null
  private _leadsMetric: HTMLElement | null = null
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

    // Panel 4: Lead Actions
    const actionsPanel = document.createElement('hud-panel')
    actionsPanel.setAttribute('label', 'Lead Actions')
    const actionTypes = ['Phone', 'Map', 'Book']
    for (const action of actionTypes) {
      const bar = document.createElement('hud-bar')
      bar.setAttribute('label', action)
      bar.setAttribute('value', '--')
      bar.setAttribute('percent', '0')
      actionsPanel.appendChild(bar)
    }

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

    // Store references for data updates
    this._visitorsMetric = visitorsMetric
    this._leadsMetric = leadsMetric

    // Listen for period changes
    this._periodChangeHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { period: string }
      this.refreshData(detail.period as HudPeriod)
    }
    this.addEventListener('hud-period-change', this._periodChangeHandler)

    // Initial data fetch
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

  private refreshData (period: HudPeriod): void {
    fetchSessionSummary('', period).match(
      (data) => {
        if (this._visitorsMetric && typeof data.total_sessions === 'number') {
          this._visitorsMetric.setAttribute('value', formatNumber(data.total_sessions))
        }
      },
      () => {} // Hold placeholders on error
    )

    fetchEventSummary('', period).match(
      (data) => {
        if (this._leadsMetric && typeof data.total_count === 'number') {
          this._leadsMetric.setAttribute('value', formatNumber(data.total_count))
        }
      },
      () => {} // Hold placeholders on error
    )

    fetchConversionSummary('', period).match(
      () => {},
      () => {} // Hold placeholders on error
    )
  }
}

customElements.define('hud-client-dashboard', ClientDashboard)
