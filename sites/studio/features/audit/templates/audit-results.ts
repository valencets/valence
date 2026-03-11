import type { LighthouseResult } from '../types/audit-types.js'

function scoreColor (score: number): string {
  if (score >= 90) return 'hsl(142, 60%, 50%)'
  if (score >= 50) return 'hsl(45, 60%, 50%)'
  return 'hsl(0, 70%, 50%)'
}

export function renderAuditResults (result: LighthouseResult): string {
  const scores = [
    { label: 'Performance', value: result.scores.performance },
    { label: 'Accessibility', value: result.scores.accessibility },
    { label: 'Best Practices', value: result.scores.bestPractices },
    { label: 'SEO', value: result.scores.seo }
  ]

  const scoreCards = scores.map((s) => `
    <div class="card" style="text-align: center;">
      <hud-metric label="${s.label}" value="${s.value}" max="100" style="--metric-color: ${scoreColor(s.value)}"></hud-metric>
    </div>`).join('')

  const metricRows = result.metrics.map((m) => `
    <tr>
      <td>${m.title}</td>
      <td style="font-variant-numeric: tabular-nums;">${m.displayValue}</td>
      <td>
        <hud-bar value="${Math.min(m.numericValue, 10000)}" max="10000" style="width: 120px;"></hud-bar>
      </td>
    </tr>`).join('')

  return `
<section class="section container">
  <h1>Audit Results</h1>
  <p class="text-sm" style="color: var(--muted-foreground);">Audited <strong>${result.url}</strong> at ${result.fetchedAt}</p>

  <div class="grid grid-4" style="margin-top: 1.5rem;">
    ${scoreCards}
  </div>
</section>

<section class="section container">
  <h2>Core Web Vitals</h2>
  <table style="width: 100%; border-collapse: collapse;">
    <thead>
      <tr>
        <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">Metric</th>
        <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">Value</th>
        <th style="text-align: left; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">Scale</th>
      </tr>
    </thead>
    <tbody>
      ${metricRows}
    </tbody>
  </table>
</section>

<section class="section container cta-section">
  <h2>Want scores like this — or better?</h2>
  <div style="display: flex; gap: 1rem; justify-content: center;">
    <a href="/audit" class="btn btn-secondary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="audit-run-another">Run Another Audit</a>
    <a href="/about#contact" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="audit-results-cta">Get In Touch</a>
  </div>
</section>`
}
