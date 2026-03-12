import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'
import { fetchFleetComparison } from '../data/fetch-fleet.js'
import { formatNumber } from '../data/format-number.js'

export class FleetComparison extends HTMLElement {
  private _initialized = false
  private _avgSessionsMetric: HTMLElement | null = null
  private _avgConversionsMetric: HTMLElement | null = null
  private _topPerformerMetric: HTMLElement | null = null

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.style.display = 'block'
    this.style.backgroundColor = HUD_COLORS.bg
    this.style.color = HUD_COLORS.textPrimary
    this.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    this.style.padding = HUD_SPACING.lg

    // Header
    const header = document.createElement('div')
    header.style.marginBottom = HUD_SPACING.lg

    const title = document.createElement('span')
    title.style.fontSize = HUD_TYPOGRAPHY.scale.lg
    title.style.fontWeight = '600'
    title.style.color = HUD_COLORS.textPrimary
    title.textContent = 'FLEET COMPARISON'

    header.appendChild(title)

    // Grid layout
    const grid = document.createElement('div')
    grid.style.display = 'grid'
    grid.style.gridTemplateColumns = '1fr 1fr 1fr'
    grid.style.gap = HUD_SPACING.md

    // Panel 1: Avg Sessions
    const sessionsPanel = document.createElement('hud-panel')
    sessionsPanel.setAttribute('label', 'Avg Sessions')
    const avgSessionsMetric = document.createElement('hud-metric')
    avgSessionsMetric.setAttribute('value', '--')
    avgSessionsMetric.setAttribute('label', 'per site/day')
    sessionsPanel.appendChild(avgSessionsMetric)

    // Panel 2: Avg Conversions
    const conversionsPanel = document.createElement('hud-panel')
    conversionsPanel.setAttribute('label', 'Avg Conversions')
    const avgConversionsMetric = document.createElement('hud-metric')
    avgConversionsMetric.setAttribute('value', '--')
    avgConversionsMetric.setAttribute('label', 'per site/day')
    conversionsPanel.appendChild(avgConversionsMetric)

    // Panel 3: Top Performer
    const topPanel = document.createElement('hud-panel')
    topPanel.setAttribute('label', 'Top Performer')
    const topPerformerMetric = document.createElement('hud-metric')
    topPerformerMetric.setAttribute('value', '--')
    topPerformerMetric.setAttribute('label', 'by sessions')
    topPanel.appendChild(topPerformerMetric)

    grid.appendChild(sessionsPanel)
    grid.appendChild(conversionsPanel)
    grid.appendChild(topPanel)

    this.appendChild(header)
    this.appendChild(grid)

    this._avgSessionsMetric = avgSessionsMetric
    this._avgConversionsMetric = avgConversionsMetric
    this._topPerformerMetric = topPerformerMetric

    this.refreshData()
  }

  disconnectedCallback (): void {
    // No listeners to clean up
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  private refreshData (): void {
    const businessType = this.getAttribute('business-type') ?? ''
    fetchFleetComparison('', businessType).match(
      (data) => {
        const first = data[0]
        if (first === undefined) return

        if (this._avgSessionsMetric !== null) {
          this._avgSessionsMetric.setAttribute('value', formatNumber(first.avg_sessions))
        }
        if (this._avgConversionsMetric !== null) {
          this._avgConversionsMetric.setAttribute('value', formatNumber(first.avg_conversions))
        }
        if (this._topPerformerMetric !== null) {
          this._topPerformerMetric.setAttribute('value', first.top_performer_site_id)
        }
      },
      () => {} // Hold placeholders on error
    )
  }
}

customElements.define('hud-fleet-comparison', FleetComparison)
