export function renderHudPage (diagnostics: boolean): string {
  const dashboard = diagnostics
    ? '<hud-diagnostic-dashboard data-sessions="/api/summaries/sessions" data-events="/api/summaries/events" data-conversions="/api/summaries/conversions" data-health="/api/diagnostics/ingestion"></hud-diagnostic-dashboard>'
    : '<hud-client-dashboard data-sessions="/api/summaries/sessions" data-events="/api/summaries/events" data-conversions="/api/summaries/conversions"></hud-client-dashboard>'

  return `
    <section class="section">
      <div class="container">
        <h1 class="hero-title">Analytics Dashboard</h1>
        ${dashboard}
      </div>
    </section>
    <script src="/js/admin.js" defer></script>
  `
}
