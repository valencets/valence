import type { AuditError } from '../types/audit-types.js'

export function renderAuditForm (error?: AuditError, url?: string): string {
  const errorHtml = error
    ? `<p class="form-error">${error.message}</p>`
    : ''

  return `
<section class="section container">
  <h1>Free Website Audit</h1>
  <p class="prose">Enter a URL and we'll run a Lighthouse audit right here on our dedicated server. No third-party services — the analysis happens on our hardware.</p>
  <p class="prose">We measure performance, accessibility, best practices, and SEO against industry standards and show you exactly where your current site falls short.</p>

  <form method="POST" action="/audit" class="audit-form" data-telemetry-type="FORM_INPUT" data-telemetry-target="audit-form">
    <div class="form-group">
      <label for="url" class="form-label">Website URL</label>
      <input type="url" id="url" name="url" class="form-input" required placeholder="https://example.com" value="${url ?? ''}">
      ${errorHtml}
    </div>
    <button type="submit" class="btn btn-primary" data-telemetry-type="CLICK" data-telemetry-target="audit-submit">Run Audit</button>
    <p class="text-sm" style="color: var(--muted-foreground); margin-top: 0.5rem;">Audits take 30-60 seconds. Limited to one per 5 minutes per visitor.</p>
  </form>
</section>`
}
