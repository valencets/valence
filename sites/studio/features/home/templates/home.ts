import {
  HERO,
  PILLARS,
  COMPARISON_TABLE,
  PAIN_CARDS,
  COMPARISON_CTA,
} from '../config/home-content.js'
import { HOME_COPY_MAP } from '../config/home-copy-map.js'
import type { CopyMapEntry } from '../config/home-copy-map.js'

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

const MARKER_CLASS: Record<string, string> = { check: 'check', cross: 'cross', warn: 'warn' }
const MARKER_SYMBOL: Record<string, string> = { check: '&#10003;', cross: '&#10005;', warn: '~' }

function renderCell (marker: string, text: string, cellClass: string): string {
  const cls = cellClass ? ` class="${cellClass}"` : ''
  if (!marker) return `<td${cls}>${text}</td>`
  return `<td${cls}><span class="${MARKER_CLASS[marker]}">${MARKER_SYMBOL[marker]}</span> ${text}</td>`
}

export function renderHome (): string {
  const accentWord = HERO.headlineAccent
  const headlineParts = HERO.headline.split(accentWord)
  // Wrap last occurrence of accent word in <em>
  const accentHeadline = headlineParts.length > 1
    ? headlineParts.slice(0, -1).join(accentWord) + `<em>${accentWord}</em>` + headlineParts[headlineParts.length - 1]
    : HERO.headline

  const heroStats = HERO.stats.map(
    (s, i) => `
      <div class="hero-stat">
        <div class="val${s.accent ? ' ' + s.accent : ''}">${esc(s.value)}</div>
        <div class="lbl"${copyAttrs(`hero-stat-${i + 1}-label`)}>${s.label}</div>
      </div>`
  ).join('')

  const pillarCards = PILLARS.map(
    (p) => `
    <div class="card" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="pillar-${p.id}">
      <span class="card-icon" aria-hidden="true">${p.icon}</span>
      <h3${copyAttrs(`pillar-${p.id}-title`)}>${p.title}</h3>
      <p${copyAttrs(`pillar-${p.id}-summary`)}>${p.summary}</p>
    </div>`
  ).join('')

  // HTML order: Feature | Inertia | Wix | Agency
  // Desktop CSS reorders to: Feature | Wix | Agency | Inertia
  const tableHeaders = `<th></th><th class="comparison-accent">${COMPARISON_TABLE.headers[3]}</th><th>${COMPARISON_TABLE.headers[1]}</th><th>${COMPARISON_TABLE.headers[2]}</th>`

  const tableRows = COMPARISON_TABLE.rows.map(
    (row) => `
      <tr>
        <td>${row.feature}</td>
        ${renderCell(row.inertiaMarker, row.inertia, row.inertiaClass)}
        ${renderCell(row.wixMarker, row.wix, row.wixClass)}
        ${renderCell(row.agencyMarker, row.agency, row.agencyClass)}
      </tr>`
  ).join('')

  const painCards = PAIN_CARDS.map(
    (card, i) => `
    <div class="pain-card${card.variant === 'ours' ? ' ours' : ''}">
      <div class="pain-label"${copyAttrs(`pain-card-${i + 1}-label`)}>${card.label}</div>
      <h3${copyAttrs(`pain-card-${i + 1}-title`)}>${card.title}</h3>
      <p${copyAttrs(`pain-card-${i + 1}-desc`)}>${card.description}</p>
      <div class="stat">${card.stat}</div>
    </div>`
  ).join('')

  const comparisonCopyEntry = HOME_COPY_MAP.find(e => e.id === 'comparison-header')
  const comparisonSubEntry = HOME_COPY_MAP.find(e => e.id === 'comparison-subtitle')

  return `
<section class="hero container">
  <div class="hero-content">
    <div class="hero-eyebrow"${copyAttrs('hero-eyebrow')}><span class="dot"></span> ${HERO.eyebrow}</div>
    <h1${copyAttrs('hero-headline')}>${accentHeadline}</h1>
    <p class="hero-sub"${copyAttrs('hero-subhead')}>${HERO.subhead}</p>
    <div class="hero-stats">
      ${heroStats}
    </div>
    <div class="hero-ctas">
      <a href="${HERO.cta.href}" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="hero-cta-primary">${HERO.cta.label} &rarr;</a>
      <a href="${HERO.ctaSecondary.href}" class="btn btn-ghost" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="hero-cta-secondary">${HERO.ctaSecondary.label}</a>
    </div>
  </div>
</section>

<section class="comparison comparison-section">
  <div class="comparison-header">
    <h2${comparisonCopyEntry ? ` data-copy-default="${esc(comparisonCopyEntry.default)}" data-copy-technical="${esc(comparisonCopyEntry.technical)}"` : ''}>${COMPARISON_TABLE.heading}</h2>
    <p${comparisonSubEntry ? ` data-copy-default="${esc(comparisonSubEntry.default)}" data-copy-technical="${esc(comparisonSubEntry.technical)}"` : ''}>${COMPARISON_TABLE.subtitle}</p>
  </div>
  <table class="comp-table">
    <thead><tr>${tableHeaders}</tr></thead>
    <tbody>${tableRows}
    </tbody>
  </table>
  <div class="pain-grid">
    ${painCards}
  </div>
  <div class="bottom-cta">
    <h3${copyAttrs('comparison-cta-headline')}>${COMPARISON_CTA.headline}</h3>
    <p>${COMPARISON_CTA.subtitle}</p>
    <a href="${COMPARISON_CTA.cta.href}" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="comparison-cta">${COMPARISON_CTA.cta.label} &rarr;</a>
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
  <a href="/free-site-audit" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="bottom-cta">Run Free Site Audit</a>
</section>`
}
