import { APPLIANCE_MODEL, SERVICE_TIERS, OWNERSHIP_LIST } from '../config/services-content.js'
import { SERVICES_COPY_MAP } from '../config/services-copy-map.js'

function esc (s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function copyAttrsForText (text: string): string {
  const entry = SERVICES_COPY_MAP.find(e => e.default === text)
  if (!entry) return ''
  return ` data-copy-default="${esc(entry.default)}" data-copy-technical="${esc(entry.technical)}"`
}

export function renderServices (): string {
  const tiers = SERVICE_TIERS.map((tier) => {
    const items = tier.includes.map((item) =>
      `<li${copyAttrsForText(item)}>${item}</li>`
    ).join('')
    return `
    <div class="card service-tier" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="tier-${tier.id}">
      <h3>${tier.name}</h3>
      <p class="tier-estimate" style="font-size:1.25rem;font-weight:600;color:var(--accent);margin-block:0.5rem">${tier.estimate}</p>
      <p>${tier.description}</p>
      <ul>${items}</ul>
    </div>`
  }).join('')

  const ownershipItems = OWNERSHIP_LIST.map((item) => `<li>${item}</li>`).join('')

  return `
<section class="section container">
  <h1>Services</h1>
  <h2>${APPLIANCE_MODEL.headline}</h2>
  <p class="prose">${APPLIANCE_MODEL.body}</p>
</section>

<section class="section container">
  <h2>Service Tiers</h2>
  <div class="grid grid-3">
    ${tiers}
  </div>
</section>

<section class="section container">
  <h2>What You Own</h2>
  <ul class="ownership-list">
    ${ownershipItems}
  </ul>
</section>

<section class="section container cta-section">
  <h2>Ready to get started?</h2>
  <a href="/about#contact" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="services-contact-cta">Request a Quote</a>
</section>`
}
