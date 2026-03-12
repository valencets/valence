import { HERO, PILLARS, ELIMINATES, OWNERSHIP } from '../config/home-content.js'
import { HOME_COPY_MAP } from '../config/home-copy-map.js'
import type { CopyMapEntry } from '../config/home-copy-map.js'

function esc (s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function copyAttrs (id: string): string {
  const entry: CopyMapEntry | undefined = HOME_COPY_MAP.find(e => e.id === id)
  if (!entry) return ''
  return ` data-copy-default="${esc(entry.default)}" data-copy-technical="${esc(entry.technical)}"`
}

export function renderHome (): string {
  const pillarCards = PILLARS.map((p) => `
    <div class="card" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="pillar-${p.id}">
      <span class="card-icon" aria-hidden="true">${p.icon}</span>
      <h3${copyAttrs(`pillar-${p.id}-title`)}>${p.title}</h3>
      <p${copyAttrs(`pillar-${p.id}-summary`)}>${p.summary}</p>
    </div>`).join('')

  const eliminateItems = ELIMINATES.map((item, i) =>
    `<li${copyAttrs(`eliminate-${i + 1}`)}>${item}</li>`
  ).join('')

  const proofMetrics = OWNERSHIP.proof.map((p, i) => `
    <div class="proof-metric">
      <span class="proof-value">${p.metric}</span>
      <span class="proof-label"${copyAttrs(`proof-${i + 1}-label`)}>${p.label}</span>
    </div>`).join('')

  return `
<section class="hero container">
  <h1${copyAttrs('hero-headline')}>${HERO.headline}</h1>
  <p${copyAttrs('hero-subhead')}>${HERO.subhead}</p>
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
  <p class="prose"${copyAttrs('ownership-body')}>${OWNERSHIP.body}</p>
  <div class="grid grid-4 proof-grid">
    ${proofMetrics}
  </div>
</section>

<section class="section container cta-section">
  <h2>Ready to own your web presence?</h2>
  <a href="/about#contact" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="bottom-cta">Contact Us</a>
</section>`
}
