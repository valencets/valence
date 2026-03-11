import { HUD_COLORS, HUD_TYPOGRAPHY, HUD_SPACING } from '../tokens/hud-tokens.js'
import { fetchIngestionHealth } from '../data/fetch-summaries.js'
import type { HudPeriod } from '../types.js'
import { formatNumber } from '../data/format-number.js'

const DIAGNOSTIC_PANELS: ReadonlyArray<{ label: string; defaultValue: string }> = [
  { label: 'Ingestion', defaultValue: '--/hr' },
  { label: 'Rejection', defaultValue: '--%' },
  { label: 'Pipeline Latency', defaultValue: '-- ms' },
  { label: 'Buffer Sat', defaultValue: '--%' },
  { label: 'DB Size', defaultValue: '-- MB' },
  { label: 'Aggregation Lag', defaultValue: '--' }
]

export class DiagnosticDashboard extends HTMLElement {
  static observedAttributes = ['gate']
  private _initialized = false
  private _metrics: HTMLElement[] = []

  connectedCallback (): void {
    if (this._initialized) return
    this._initialized = true
    this.style.backgroundColor = HUD_COLORS.bg
    this.style.color = HUD_COLORS.textPrimary
    this.style.fontFamily = HUD_TYPOGRAPHY.fontPrimary
    this.style.padding = HUD_SPACING.lg

    this.updateGate()

    // Header
    const header = document.createElement('div')
    header.style.display = 'flex'
    header.style.justifyContent = 'space-between'
    header.style.alignItems = 'center'
    header.style.marginBottom = HUD_SPACING.lg

    const title = document.createElement('span')
    title.style.fontSize = HUD_TYPOGRAPHY.scale.lg
    title.style.fontWeight = '600'
    title.style.color = HUD_COLORS.textPrimary
    title.textContent = 'INERTIA DIAGNOSTICS'

    header.appendChild(title)

    // Grid layout: 3 columns x 2 rows
    const grid = document.createElement('div')
    grid.style.display = 'grid'
    grid.style.gridTemplateColumns = '1fr 1fr 1fr'
    grid.style.gap = HUD_SPACING.md

    for (const config of DIAGNOSTIC_PANELS) {
      const panel = document.createElement('hud-panel')
      panel.setAttribute('label', config.label)

      const metric = document.createElement('hud-metric')
      metric.setAttribute('value', config.defaultValue)
      metric.setAttribute('delta', '')
      metric.setAttribute('delta-direction', 'flat')

      const status = document.createElement('hud-status')
      status.setAttribute('state', 'nominal')
      status.setAttribute('label', 'nominal')

      panel.appendChild(metric)
      panel.appendChild(status)
      grid.appendChild(panel)
      this._metrics.push(metric)
    }

    this.appendChild(header)
    this.appendChild(grid)

    this.refreshData('7D')
  }

  disconnectedCallback (): void {
    // Intentional no-op
  }

  connectedMoveCallback (): void {
    // Intentional no-op — signals move-awareness to router
  }

  attributeChangedCallback (name: string, _old: string | null, _value: string | null): void {
    const handlers: Record<string, () => void> = {
      gate: () => this.updateGate()
    }
    handlers[name]?.()
  }

  private updateGate (): void {
    const gate = this.getAttribute('gate')
    this.style.display = gate === 'open' ? 'block' : 'none'
  }

  private refreshData (period: HudPeriod): void {
    fetchIngestionHealth('', period).match(
      (data) => {
        if (typeof data.payloads_accepted !== 'number') return
        // Ingestion rate
        if (this._metrics[0]) {
          this._metrics[0].setAttribute('value', `${formatNumber(data.payloads_accepted)}/hr`)
        }
        // Rejection rate
        if (this._metrics[1]) {
          const total = data.payloads_accepted + data.payloads_rejected
          const pct = total > 0 ? ((data.payloads_rejected / total) * 100).toFixed(1) : '0'
          this._metrics[1].setAttribute('value', `${pct}%`)
        }
        // Pipeline latency
        if (this._metrics[2] && typeof data.avg_processing_ms === 'number') {
          this._metrics[2].setAttribute('value', `${data.avg_processing_ms.toFixed(1)} ms`)
        }
        // Buffer saturation
        if (this._metrics[3] && typeof data.buffer_saturation_pct === 'number') {
          this._metrics[3].setAttribute('value', `${data.buffer_saturation_pct}%`)
        }
      },
      () => {} // Hold placeholders on error
    )
  }
}

customElements.define('hud-diagnostic-dashboard', DiagnosticDashboard)
