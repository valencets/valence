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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--background);
  color: var(--foreground);
}
main { flex: 1; }

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
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--background);
  border-bottom: 1px solid var(--border);
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
  text-decoration: none;
  margin-left: ${SPACING.scale[2]};
}
.footer-hardware a:hover { text-decoration: underline; }

/* Hero */
.hero {
  height: clamp(600px, 100vh, 900px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}
.hero h1 {
  font-size: ${TYPOGRAPHY.scale['4xl']};
  font-weight: ${TYPOGRAPHY.fontWeight.bold};
  line-height: ${TYPOGRAPHY.lineHeight.tight};
  max-width: 18ch;
  margin-inline: auto;
}
.hero p {
  font-size: ${TYPOGRAPHY.scale.lg};
  color: var(--muted-foreground);
  max-width: ${TYPOGRAPHY.maxWidth};
  margin-inline: auto;
  margin-top: ${SPACING.scale[6]};
  line-height: ${TYPOGRAPHY.lineHeight.body};
}

/* Cards */
.card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: ${SPACING.scale[6]};
}

/* Proof metrics (Total Ownership section) */
.proof-grid { margin-top: ${SPACING.scale[8]}; }
.proof-metric {
  text-align: center;
  padding: ${SPACING.scale[6]};
}
.proof-value {
  display: block;
  font-size: ${TYPOGRAPHY.scale['3xl']};
  font-weight: ${TYPOGRAPHY.fontWeight.bold};
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
.proof-label {
  display: block;
  font-size: ${TYPOGRAPHY.scale.sm};
  color: var(--muted-foreground);
  margin-top: ${SPACING.scale[2]};
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

/* Eliminate list (× markers) */
.eliminate-list { list-style: none; padding: 0; }
.eliminate-list li {
  padding: ${SPACING.scale[2]} 0;
  padding-left: ${SPACING.scale[6]};
  position: relative;
}
.eliminate-list li::before {
  content: "\\00d7";
  position: absolute;
  left: 0;
  color: var(--destructive);
  font-weight: bold;
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
`

  return tokenCSS + studioCSS
}
