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

  <form method="POST" action="/free-site-audit" class="audit-form" data-telemetry-type="FORM_INPUT" data-telemetry-target="audit-form">
    <div class="form-group">
      <label for="url" class="form-label">Website URL</label>
      <input type="url" id="url" name="url" class="form-input" required placeholder="https://example.com" value="${url ?? ''}">
      ${errorHtml}
    </div>
    <button type="submit" class="btn btn-primary audit-submit" data-telemetry-type="CLICK" data-telemetry-target="audit-submit">
      <span class="audit-btn-label">Run Audit</span>
      <span class="audit-btn-loading" hidden><span class="spinner" aria-hidden="true"></span> Scanning\u2026</span>
    </button>
    <div class="audit-status">
      <p class="audit-status-idle text-sm">Audits take 30-60 seconds. Limited to one per 5 minutes per visitor.</p>
      <div class="audit-status-loading" hidden>
        <div class="audit-progress-bar"><div class="audit-progress-fill"></div></div>
        <p class="text-sm">Scanning site\u2026 this usually takes 30\u201360 seconds</p>
      </div>
    </div>
  </form>
</section>`
}
