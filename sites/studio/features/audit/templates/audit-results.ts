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
      <div style="font-size: 2.5rem; font-weight: 700; color: ${scoreColor(s.value)}; line-height: 1;">${s.value}</div>
      <div style="font-size: 0.875rem; color: var(--muted-foreground); margin-top: 0.25rem;">${s.label}</div>
    </div>`).join('')

  const metricRows = result.metrics.map((m) => `
    <tr>
      <td>${m.title}</td>
      <td style="font-variant-numeric: tabular-nums;">${m.displayValue}</td>
      <td>
        <div style="width: 120px; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden;">
          <div style="width: ${Math.min(m.numericValue / 10000 * 100, 100)}%; height: 100%; background: var(--primary); border-radius: 4px;"></div>
        </div>
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

<section class="section container audit-cta">
  <h3>${result.scores.performance < 90 ? 'Your site is leaving money on the table.' : 'Want these numbers to be perfect?'}</h3>
  <p>${result.scores.performance < 90 ? "Let's fix that." : "We build sites that score 100 across the board. Let's talk about what yours could look like."}</p>
  <div style="display: flex; gap: 1rem; justify-content: center;">
    <a href="/audit" class="btn btn-secondary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="audit-run-another">Run Another Audit</a>
    <a href="/about#contact" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="audit-results-cta">Request a Free Consultation</a>
  </div>
</section>`
}
