import { resolveTheme, generateCSS } from '@inertia/tokens'
import type { ThemeConfig } from '@inertia/tokens'
import { studioTheme } from './studio-theme.js'
import { TYPOGRAPHY } from './studio-typography.js'
import { SPACING } from './studio-spacing.js'
import baseThemeData from '@inertia/tokens/base.json' with { type: 'json' }

const baseTheme = baseThemeData as unknown as ThemeConfig

export function getResolvedTheme (): ThemeConfig {
  return resolveTheme(studioTheme, baseTheme)
}

// Strip Tailwind-only directives from token CSS, keeping browser-valid blocks
function stripTailwindDirectives (css: string): string {
  let result = css
  // Remove @custom-variant lines
  result = result.replace(/^@custom-variant[^\n]*\n?/gm, '')
  // Remove @theme inline { ... } blocks (nested braces)
  result = removeBlock(result, '@theme inline')
  // Remove @layer base { ... } blocks (nested braces)
  result = removeBlock(result, '@layer base')
  // Collapse excessive blank lines
  result = result.replace(/\n{3,}/g, '\n\n').trim()
  return result
}

// Remove a top-level block by tracking brace depth
function removeBlock (css: string, marker: string): string {
  const idx = css.indexOf(marker)
  if (idx === -1) return css
  const braceStart = css.indexOf('{', idx)
  if (braceStart === -1) return css
  let depth = 1
  let i = braceStart + 1
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++
    if (css[i] === '}') depth--
    i++
  }
  return css.substring(0, idx) + css.substring(i)
}

export function getStudioCSS (): string {
  const resolved = getResolvedTheme()
  const rawTokenCSS = generateCSS(resolved)
  const tokenCSS = stripTailwindDirectives(rawTokenCSS)

  // Append studio-specific utility CSS
  const studioCSS = `
/* Dank Mono web font */
@font-face {
  font-family: "Dank Mono";
  src: url("/fonts/DankMono-Regular.woff2") format("woff2");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Dank Mono";
  src: url("/fonts/DankMono-Bold.woff2") format("woff2");
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Dank Mono";
  src: url("/fonts/DankMono-Italic.woff2") format("woff2");
  font-weight: 400;
  font-style: italic;
  font-display: swap;
}

/* Viewport flex layout */
html { height: 100%; }
body {
  margin: 0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
}
main { flex: 1; position: relative; z-index: 1; padding-top: ${SPACING.scale[12]}; }
footer { position: relative; z-index: 1; }

/* Site-wide halftone texture — fixed behind all content, persists across navigations */
.site-halftone {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

/* Studio layout utilities */
.container {
  max-width: ${SPACING.grid.maxWidth};
  margin-inline: auto;
  padding-inline: ${SPACING.grid.margin};
}

@media (min-width: 768px) {
  .container { padding-inline: ${SPACING.grid.gutter}; }
}

/* Typography */
.prose { max-width: ${TYPOGRAPHY.maxWidth}; }
.text-xs { font-size: ${TYPOGRAPHY.scale.xs}; }
.text-sm { font-size: ${TYPOGRAPHY.scale.sm}; }
.text-base { font-size: ${TYPOGRAPHY.scale.base}; }
.text-lg { font-size: ${TYPOGRAPHY.scale.lg}; }
.text-xl { font-size: ${TYPOGRAPHY.scale.xl}; }
.text-2xl { font-size: ${TYPOGRAPHY.scale['2xl']}; }
.text-3xl { font-size: ${TYPOGRAPHY.scale['3xl']}; }
.text-4xl { font-size: ${TYPOGRAPHY.scale['4xl']}; }

/* Section spacing */
.section {
  padding-block: ${SPACING.section.paddingYMobile};
}
@media (min-width: 768px) {
  .section { padding-block: ${SPACING.section.paddingY}; }
}

/* Navigation */
nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: transparent;
  border-bottom: 1px solid transparent;
  transition: background 0.3s, border-color 0.3s;
}
nav.nav-scrolled {
  background: var(--background);
  border-bottom-color: var(--border);
}
.nav-inner {
  max-width: ${SPACING.grid.maxWidth};
  margin-inline: auto;
  padding: ${SPACING.scale[3]} ${SPACING.grid.margin};
  display: flex;
  align-items: center;
  gap: ${SPACING.scale[6]};
  overflow-x: auto;
}
@media (min-width: 768px) {
  .nav-inner { padding-inline: ${SPACING.grid.gutter}; }
}
.nav-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: ${TYPOGRAPHY.fontWeight.bold};
  font-size: ${TYPOGRAPHY.scale.lg};
  color: var(--foreground);
  text-decoration: none;
  margin-right: auto;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  flex-shrink: 0;
}
.nav-mark { display: block; width: 24px; height: 24px; }
nav a {
  color: var(--muted-foreground);
  text-decoration: none;
  font-size: ${TYPOGRAPHY.scale.sm};
  transition: color 0.15s;
  white-space: nowrap;
}
nav a:hover, nav a.nav-active {
  color: var(--foreground);
}

/* Footer */
footer {
  border-top: 1px solid var(--border);
  margin-top: ${SPACING.scale[16]};
  padding-bottom: 40px;
}
.footer-inner {
  max-width: ${SPACING.grid.maxWidth};
  margin-inline: auto;
  padding: ${SPACING.scale[8]} ${SPACING.grid.margin};
  font-size: ${TYPOGRAPHY.scale.sm};
  color: var(--muted-foreground);
}
.footer-hardware {
  margin-top: ${SPACING.scale[2]};
  font-family: var(--font-mono);
  font-size: ${TYPOGRAPHY.scale.xs};
}
.footer-hardware a {
  color: var(--primary);
  text-decoration: underline;
  margin-left: ${SPACING.scale[2]};
}

/* Hero */
.hero {
  position: relative;
  overflow: hidden;
  height: clamp(600px, 100vh, 900px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.hero-content {
  max-width: 740px;
  padding: ${SPACING.scale[8]};
}
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: ${SPACING.scale[2]};
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: ${SPACING.scale[1]} ${SPACING.scale[4]};
  font-size: ${TYPOGRAPHY.scale.sm};
  color: var(--muted-foreground);
  margin-bottom: ${SPACING.scale[6]};
}
.hero-pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chart-2);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.hero h1 {
  font-size: ${TYPOGRAPHY.scale['4xl']};
  font-weight: ${TYPOGRAPHY.fontWeight.bold};
  line-height: ${TYPOGRAPHY.lineHeight.tight};
  max-width: 22ch;
  margin-inline: auto;
}
.hero h1 em {
  font-style: normal;
  color: var(--primary);
}
.hero p {
  font-size: ${TYPOGRAPHY.scale.lg};
  color: var(--muted-foreground);
  max-width: ${TYPOGRAPHY.maxWidth};
  margin-inline: auto;
  margin-top: ${SPACING.scale[6]};
  line-height: ${TYPOGRAPHY.lineHeight.body};
}
.hero-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-top: ${SPACING.scale[8]};
  margin-bottom: ${SPACING.scale[4]};
}
.hero-stat {
  background: var(--card);
  padding: ${SPACING.scale[4]} ${SPACING.scale[3]};
  text-align: center;
}
.hero-stat-value {
  display: block;
  font-size: ${TYPOGRAPHY.scale['2xl']};
  font-weight: ${TYPOGRAPHY.fontWeight.bold};
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.hero-stat-label {
  display: block;
  font-size: ${TYPOGRAPHY.scale.xs};
  color: var(--muted-foreground);
  margin-top: ${SPACING.scale[1]};
}

/* Cards */
.card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: ${SPACING.scale[6]};
}

/* Ghost button */
.btn-ghost {
  background: transparent;
  color: var(--foreground);
  border: 1px solid var(--border);
}
.btn-ghost:hover {
  background: var(--card);
}

/* Comparison table */
.comparison-header { text-align: center; margin-bottom: ${SPACING.scale[8]}; }
.comparison-header p {
  color: var(--muted-foreground);
  margin-top: ${SPACING.scale[3]};
  font-size: ${TYPOGRAPHY.scale.lg};
}
.comparison-table-wrap { overflow-x: auto; }
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: ${TYPOGRAPHY.scale.sm};
}
.comparison-table th {
  padding: ${SPACING.scale[3]} ${SPACING.scale[4]};
  text-align: left;
  font-weight: ${TYPOGRAPHY.fontWeight.semibold};
  border-bottom: 2px solid var(--border);
  color: var(--muted-foreground);
  white-space: nowrap;
}
.comparison-table td {
  padding: ${SPACING.scale[3]} ${SPACING.scale[4]};
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
.comparison-accent {
  color: var(--primary);
  border-left: 2px solid var(--primary);
}

/* Marker icons */
.marker-pass { color: var(--chart-2); font-weight: ${TYPOGRAPHY.fontWeight.bold}; }
.marker-fail { color: var(--destructive); font-weight: ${TYPOGRAPHY.fontWeight.bold}; }
.marker-partial { color: var(--chart-3); font-weight: ${TYPOGRAPHY.fontWeight.bold}; }

/* Pain cards */
.pain-cards {
  display: grid;
  grid-template-columns: 1fr;
  gap: ${SPACING.grid.gutter};
  margin-top: ${SPACING.scale[10]};
}
@media (min-width: 768px) {
  .pain-cards { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .pain-cards { grid-template-columns: repeat(3, 1fr); }
}
.pain-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: ${SPACING.scale[6]};
  display: flex;
  flex-direction: column;
  gap: ${SPACING.scale[3]};
}
.pain-card-pain { border-top: 3px solid var(--destructive); }
.pain-card-ours { border-top: 3px solid var(--chart-2); }
.pain-label {
  font-size: ${TYPOGRAPHY.scale.xs};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted-foreground);
}
.pain-card h3 { font-size: ${TYPOGRAPHY.scale.base}; margin: 0; }
.pain-card p {
  font-size: ${TYPOGRAPHY.scale.sm};
  color: var(--muted-foreground);
  line-height: ${TYPOGRAPHY.lineHeight.body};
  margin: 0;
}
.pain-stat {
  font-size: ${TYPOGRAPHY.scale.sm};
  font-weight: ${TYPOGRAPHY.fontWeight.semibold};
  color: var(--primary);
  margin-top: auto;
}

/* Comparison CTA */
.comparison-cta {
  text-align: center;
  padding-top: ${SPACING.scale[10]};
}
.comparison-cta p {
  color: var(--muted-foreground);
  margin-top: ${SPACING.scale[3]};
  margin-bottom: ${SPACING.scale[6]};
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${SPACING.scale[3]} ${SPACING.scale[6]};
  border-radius: var(--radius);
  font-size: ${TYPOGRAPHY.scale.sm};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  border: none;
}
.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
}
.btn-primary:hover {
  opacity: 0.9;
}
.btn-secondary {
  background: var(--secondary);
  color: var(--secondary-foreground);
  border: 1px solid var(--border);
}

/* Grid */
.grid { display: grid; gap: ${SPACING.grid.gutter}; }
.grid-2x2 { grid-template-columns: repeat(2, 1fr); }
.grid-2 { grid-template-columns: 1fr; }
.grid-3 { grid-template-columns: 1fr; }
.grid-4 { grid-template-columns: 1fr; }
@media (min-width: 768px) {
  .grid-2 { grid-template-columns: repeat(2, 1fr); }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(4, 1fr); }
}

/* Forms */
.form-group { margin-bottom: ${SPACING.scale[4]}; }
.form-label {
  display: block;
  font-size: ${TYPOGRAPHY.scale.sm};
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  margin-bottom: ${SPACING.scale[2]};
  color: var(--foreground);
}
.form-input, .form-textarea, .form-select {
  width: 100%;
  padding: ${SPACING.scale[3]};
  background: var(--input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--foreground);
  font-size: ${TYPOGRAPHY.scale.base};
  font-family: inherit;
}
.form-input:focus, .form-textarea:focus, .form-select:focus {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.form-textarea { min-height: 8rem; resize: vertical; }
.form-error { color: var(--destructive); font-size: ${TYPOGRAPHY.scale.sm}; margin-top: ${TYPOGRAPHY.scale.xs}; }
.form-success { color: hsl(142, 60%, 50%); font-size: ${TYPOGRAPHY.scale.sm}; }

/* Utility */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
}

/* Hero CTA row */
.hero-cta {
  display: flex;
  gap: ${SPACING.scale[4]};
  justify-content: center;
  flex-wrap: wrap;
  margin-top: ${SPACING.scale[8]};
}


/* Appliance Model spec list */
.spec-list {
  padding: ${SPACING.scale[6]};
  list-style: none;
}
.spec-row {
  display: flex;
  justify-content: space-between;
  padding: ${SPACING.scale[3]} 0;
  border-bottom: 1px solid var(--border);
}
.spec-row:last-child { border-bottom: none; }
.spec-row dt {
  font-size: ${TYPOGRAPHY.scale.sm};
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.spec-row dd {
  font-weight: ${TYPOGRAPHY.fontWeight.semibold};
  color: var(--foreground);
  margin: 0;
}

/* CTA section */
.cta-section {
  text-align: center;
  padding-block: ${SPACING.section.paddingY};
}

/* Contact info bar */
.contact-info {
  display: flex;
  gap: ${SPACING.scale[8]};
  justify-content: center;
  flex-wrap: wrap;
  padding-top: ${SPACING.scale[6]};
  margin-top: ${SPACING.scale[6]};
  border-top: 1px solid var(--border);
}
.contact-info a {
  color: var(--primary);
  text-decoration: none;
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
}
.contact-info a:hover { text-decoration: underline; }

/* Glass Box inspector tooltip */
.gb-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 2px 0;
  gap: ${SPACING.scale[3]};
}
.gb-label {
  font-size: 10px;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.gb-value {
  font-size: 11px;
  color: var(--primary);
  font-weight: ${TYPOGRAPHY.fontWeight.semibold};
  text-align: right;
  word-break: break-all;
}
.gb-explainer {
  font-size: 10px;
  color: var(--muted-foreground);
  line-height: ${TYPOGRAPHY.lineHeight.body};
  margin: 0;
}

/* Hamburger nav toggle */
.nav-hamburger {
  display: none;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  flex-direction: column;
  gap: 4px;
}
.nav-hamburger span {
  display: block;
  width: 20px;
  height: 2px;
  background: var(--foreground);
  border-radius: 1px;
}
.nav-links {
  display: flex;
  align-items: center;
  gap: ${SPACING.scale[6]};
}
.nav-cta {
  background: var(--primary);
  color: var(--primary-foreground);
  padding: ${SPACING.scale[2]} ${SPACING.scale[4]};
  border-radius: var(--radius);
  font-weight: ${TYPOGRAPHY.fontWeight.medium};
  font-size: ${TYPOGRAPHY.scale.sm};
  white-space: nowrap;
}

/* Mobile styles */
@media (max-width: 767px) {
  .nav-hamburger { display: flex; }
  .nav-links {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--background);
    border-bottom: 1px solid var(--border);
    padding: ${SPACING.scale[4]} ${SPACING.grid.margin};
    z-index: 99;
  }
  .nav-links.open {
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }
  .nav-links.open a {
    padding: ${SPACING.scale[3]} 0;
    border-bottom: 1px solid var(--border);
  }
  .nav-inner { position: relative; overflow-x: visible; }
  .hero h1 { font-size: 2rem; }
  .hero p { font-size: 1rem; }
  .hero { height: auto; min-height: 80vh; padding-block: 3rem; }
  .hero-stats { grid-template-columns: repeat(2, 1fr); }
  inertia-buffer-strip { display: none; }
  .form-input, .form-textarea, .form-select {
    padding: 1rem;
    font-size: 16px;
    width: 100%;
    box-sizing: border-box;
  }
  .form-textarea { min-height: 6rem; }
  .form-group {
    margin-bottom: ${SPACING.scale[5]};
    padding: 0;
  }
  form .btn-primary {
    width: 100%;
    padding: ${SPACING.scale[4]} ${SPACING.scale[6]};
  }
  .cta-section { text-align: center; }
  .cta-section .btn-primary { width: auto; }
  .contact-info {
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  footer { padding-bottom: 16px; }
}

/* Principles */
.principles-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
}
@media (min-width: 768px) {
  .principles-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2.5rem;
  }
}
.principle-section.card {
  padding: 2rem 1.5rem;
  border-left: 3px solid var(--primary);
}
.principle-header {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.principle-number {
  font-family: var(--font-mono);
  font-size: 2.4rem;
  color: var(--primary);
  opacity: 0.4;
  line-height: 1;
}
.principle-section h2 {
  font-size: 1.5rem;
  margin: 0;
}
@media (min-width: 768px) {
  .principle-section h2 { font-size: 1.95rem; }
}
.principle-details {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
}
@media (min-width: 768px) {
  .principle-details {
    grid-template-columns: 1fr 1fr;
  }
  .principle-origin {
    grid-row: 1 / 3;
  }
  .principle-benefit {
    grid-column: 1 / -1;
  }
}
.principle-origin h3,
.principle-how h3,
.principle-benefit h3 {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted-foreground);
  margin: 0 0 0.5rem;
}
.principle-benefit {
  background: hsl(215,60%,48%,0.06);
  border: 1px solid hsl(215,60%,48%,0.12);
  border-radius: var(--radius);
  padding: 1rem;
}
.principle-benefit h3 {
  color: var(--primary);
}

/* Audit loading */
.audit-status { margin-top: 0.5rem; }
.audit-status p { color: var(--muted-foreground); }
.audit-btn-loading { display: inline-flex; align-items: center; gap: 0.5rem; }
.audit-btn-loading[hidden] { display: none; }
.audit-btn-label[hidden] { display: none; }
.spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: -0.15em;
}
@keyframes spin { to { transform: rotate(360deg); } }
.audit-progress-bar {
  height: 3px;
  background: var(--border);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 1rem;
}
.audit-progress-fill {
  height: 100%;
  width: 30%;
  background: var(--primary);
  border-radius: 2px;
  animation: scan 1.5s ease-in-out infinite;
}
@keyframes scan {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(433%); }
}
`

  return tokenCSS + studioCSS
}
