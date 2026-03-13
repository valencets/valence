import {
  HERO,
  PILLARS,
  ELIMINATES,
  OWNERSHIP,
} from '../config/home-content.js'
import { HOME_COPY_MAP } from '../config/home-copy-map.js'
import type { CopyMapEntry } from '../config/home-copy-map.js'
import {
  HALFTONE_VIEWBOX,
  ORGANIC_PATTERN,
  GRAIN_PATTERN,
  FADE_GRADIENT
} from '../config/halftone-config.js'

function esc (s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function copyAttrs (id: string): string {
  const entry: CopyMapEntry | undefined = HOME_COPY_MAP.find(
    (e) => e.id === id
  )
  if (!entry) return ''
  return ` data-copy-default="${esc(entry.default)}" data-copy-technical="${esc(entry.technical)}"`
}

function renderPattern (p: typeof ORGANIC_PATTERN | typeof GRAIN_PATTERN): string {
  const dots = p.dots.map(d =>
    `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="var(--primary)"/>`
  ).join('')
  return `<pattern id="${p.id}" width="${p.cellSize}" height="${p.cellSize}" patternUnits="userSpaceOnUse" patternTransform="rotate(${p.rotation})">${dots}</pattern>`
}

function renderHalftone (): string {
  const stops = FADE_GRADIENT.stops.map(s =>
    `<stop offset="${s.offset}" stop-color="white" stop-opacity="${s.opacity}"/>`
  ).join('')

  return `<svg class="hero-halftone" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMin slice" viewBox="${HALFTONE_VIEWBOX}">
    <defs>
      <linearGradient id="${FADE_GRADIENT.id}" x1="0" y1="0" x2="0.45" y2="0.45">${stops}</linearGradient>
      ${renderPattern(ORGANIC_PATTERN)}
      ${renderPattern(GRAIN_PATTERN)}
      <mask id="fade-mask"><rect width="100%" height="100%" fill="url(#${FADE_GRADIENT.id})"/></mask>
    </defs>
    <rect width="100%" height="100%" fill="url(#${ORGANIC_PATTERN.id})" mask="url(#fade-mask)" opacity="${ORGANIC_PATTERN.opacity}"/>
    <rect width="100%" height="100%" fill="url(#${GRAIN_PATTERN.id})" mask="url(#fade-mask)" opacity="${GRAIN_PATTERN.opacity}"/>
  </svg>`
}

export function renderHome (): string {
  const pillarCards = PILLARS.map(
    (p) => `
    <div class="card" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="pillar-${p.id}">
      <span class="card-icon" aria-hidden="true">${p.icon}</span>
      <h3${copyAttrs(`pillar-${p.id}-title`)}>${p.title}</h3>
      <p${copyAttrs(`pillar-${p.id}-summary`)}>${p.summary}</p>
    </div>`
  ).join('')

  const eliminateItems = ELIMINATES.map(
    (item, i) => `<li${copyAttrs(`eliminate-${i + 1}`)}>${item}</li>`
  ).join('')

  const proofMetrics = OWNERSHIP.proof
    .map(
      (p, i) => `
    <div class="proof-metric">
      <span class="proof-value">${p.metric}</span>
      <span class="proof-label"${copyAttrs(`proof-${i + 1}-label`)}>${p.label}</span>
    </div>`
    )
    .join('')

  return `
<section class="hero container">
  ${renderHalftone()}
  <div class="hero-content">
  <h1${copyAttrs('hero-headline')}>${HERO.headline}</h1>
  <p${copyAttrs('hero-subhead')}>${HERO.subhead}</p>
  <div class="hero-cta">
    <a href="${HERO.cta.href}" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="hero-cta-primary">${HERO.cta.label}</a>
    <a href="${HERO.ctaSecondary.href}" class="btn btn-secondary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="hero-cta-secondary">${HERO.ctaSecondary.label}</a>
  </div>
  </div>
</section>

<section class="section container value-proposition">
  <div class="grid grid-2">
    <div class="eliminate-section">
      <h2>What We Eliminate</h2>
      <ul class="eliminate-list">
        ${eliminateItems}
      </ul>
    </div>
    <div class="ownership-section">
      <h2>${OWNERSHIP.headline}</h2>
      <p class="prose"${copyAttrs('ownership-body')}>${OWNERSHIP.body}</p>
    </div>
  </div>
  <div class="grid grid-2x2 proof-grid">
    ${proofMetrics}
  </div>
</section>

<section class="section container pillars-section">
  <h2>How We Build Different</h2>
  <div class="grid grid-4">
    ${pillarCards}
  </div>
</section>

<section class="section container speed-section">
  <h2>Navigate between pages. Watch the difference.</h2>
  <inertia-speed-showcase data-inertia-persist id="speed-showcase"></inertia-speed-showcase>
</section>

<section class="section container cta-section">
  <h2>Ready to own your web presence?</h2>
  <a href="/about#contact" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="bottom-cta">Contact Us</a>
</section>`
}
