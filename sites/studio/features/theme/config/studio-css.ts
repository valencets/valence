import { resolveTheme, generateCSS } from '@inertia/tokens'
import type { ThemeConfig } from '@inertia/tokens'
import { studioTheme } from './studio-theme.js'
import { TYPOGRAPHY } from './studio-typography.js'
import { SPACING } from './studio-spacing.js'
import baseThemeData from '../../../../../packages/tokens/base.json' with { type: 'json' }

const baseTheme = baseThemeData as unknown as ThemeConfig

export function getResolvedTheme (): ThemeConfig {
  return resolveTheme(studioTheme, baseTheme)
}

export function getStudioCSS (): string {
  const resolved = getResolvedTheme()
  const tokenCSS = generateCSS(resolved)

  // Append studio-specific utility CSS
  const studioCSS = `
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
}
@media (min-width: 768px) {
  .nav-inner { padding-inline: ${SPACING.grid.gutter}; }
}
.nav-brand {
  font-weight: ${TYPOGRAPHY.fontWeight.bold};
  font-size: ${TYPOGRAPHY.scale.lg};
  color: var(--foreground);
  text-decoration: none;
  margin-right: auto;
}
nav a {
  color: var(--muted-foreground);
  text-decoration: none;
  font-size: ${TYPOGRAPHY.scale.sm};
  transition: color 0.15s;
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

/* Hero */
.hero {
  padding-block: ${SPACING.scale[20]};
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
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: ${SPACING.scale[6]};
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
.form-success { color: oklch(0.72 0.17 142); font-size: ${TYPOGRAPHY.scale.sm}; }

/* Utility */
.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border-width: 0;
}
`

  return tokenCSS + studioCSS
}
