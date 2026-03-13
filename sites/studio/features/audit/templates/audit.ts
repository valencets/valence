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
</section>
<script>
document.querySelector('.audit-form').addEventListener('submit', function (e) {
  e.preventDefault()
  var form = this
  var btn = form.querySelector('.audit-submit')
  btn.disabled = true
  btn.querySelector('.audit-btn-label').hidden = true
  btn.querySelector('.audit-btn-loading').hidden = false
  form.querySelector('.audit-status-idle').hidden = true
  form.querySelector('.audit-status-loading').hidden = false

  fetch(form.action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Inertia-Fragment': '1' },
    body: new URLSearchParams(new FormData(form))
  }).then(function (res) {
    return res.text().then(function (html) {
      var title = res.headers.get('X-Inertia-Title')
      var main = document.querySelector('#main-content')
      document.dispatchEvent(new CustomEvent('inertia:before-swap'))
      var doc = new DOMParser().parseFromString(html, 'text/html')
      var fragment = doc.querySelector('#main-content') || doc.body
      main.replaceChildren.apply(main, Array.from(fragment.childNodes))
      document.dispatchEvent(new CustomEvent('inertia:after-swap'))
      if (title) document.title = title
      window.scrollTo(0, 0)
    })
  }, function () {
    btn.disabled = false
    btn.querySelector('.audit-btn-label').hidden = false
    btn.querySelector('.audit-btn-loading').hidden = true
    form.querySelector('.audit-status-idle').hidden = false
    form.querySelector('.audit-status-loading').hidden = true
  })
})
</script>`
}
