import { HERO, PILLARS, ELIMINATES, OWNERSHIP } from '../config/home-content.js'

export function renderHome (): string {
  const pillarCards = PILLARS.map((p) => `
    <div class="card" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="pillar-${p.id}">
      <span class="card-icon" aria-hidden="true">${p.icon}</span>
      <h3>${p.title}</h3>
      <p>${p.summary}</p>
    </div>`).join('')

  const eliminateItems = ELIMINATES.map((item) =>
    `<li>${item}</li>`
  ).join('')

  const proofMetrics = OWNERSHIP.proof.map((p) => `
    <div class="proof-metric">
      <span class="proof-value">${p.metric}</span>
      <span class="proof-label">${p.label}</span>
    </div>`).join('')

  return `
<section class="hero container">
  <h1>${HERO.headline}</h1>
  <p>${HERO.subhead}</p>
  <div class="hero-cta">
    <a href="${HERO.cta.href}" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="hero-cta-primary">${HERO.cta.label}</a>
    <a href="${HERO.ctaSecondary.href}" class="btn btn-secondary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="hero-cta-secondary">${HERO.ctaSecondary.label}</a>
  </div>
</section>

<section class="section container">
  <h2>The Four Pillars</h2>
  <div class="grid grid-4">
    ${pillarCards}
  </div>
</section>

<section class="section container">
  <h2>What We Eliminate</h2>
  <ul class="eliminate-list">
    ${eliminateItems}
  </ul>
</section>

<section class="section container">
  <h2>${OWNERSHIP.headline}</h2>
  <p class="prose">${OWNERSHIP.body}</p>
  <div class="grid grid-4 proof-grid">
    ${proofMetrics}
  </div>
</section>

<section class="section container cta-section">
  <h2>Ready to own your web presence?</h2>
  <a href="/contact" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="bottom-cta">Contact Us</a>
</section>`
}
