import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'
import { fetchFleetSites } from '../data/fetch-fleet.js'

export class FleetDashboard extends HTMLElement {
  private _initialized = false

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
    title.textContent = 'FLEET OVERVIEW'

    header.appendChild(title)

    // Sites panel with table
    const sitesPanel = document.createElement('hud-panel')
    sitesPanel.setAttribute('label', 'Sites')

    const sitesTable = document.createElement('hud-table')
    sitesTable.setAttribute('columns', JSON.stringify([
      { label: 'Status', key: 'status', align: 'left' },
      { label: 'Site', key: 'site_id', align: 'left' },
      { label: 'Type', key: 'business_type', align: 'left' },
      { label: 'Sessions', key: 'session_count', align: 'right', numeric: true },
      { label: 'Conversions', key: 'conversion_count', align: 'right', numeric: true },
      { label: 'Last Sync', key: 'last_synced', align: 'right' }
    ]))
    sitesTable.setAttribute('rows', '[]')

    sitesPanel.appendChild(sitesTable)

    this.appendChild(header)
    this.appendChild(sitesPanel)

    // Fetch data
    this.refreshData()
  }

  disconnectedCallback (): void {
    // No listeners to clean up
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  private refreshData (): void {
    fetchFleetSites('').match(
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
      },
      () => {} // Hold placeholders on error
    )
  }
}

customElements.define('hud-fleet-dashboard', FleetDashboard)
