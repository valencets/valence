// Kinetic Monolith admin styles.
// Token values (--val-*) are delivered via ThemeManager constructable stylesheets
// adopted into ValElement shadow roots. This file provides only the page-level
// layout and component CSS that sits OUTSIDE shadow DOM.

/**
 * Kinetic Monolith surface palette — the tonal layering hierarchy.
 * These are page-level custom properties (not ValElement tokens) used
 * for backgrounds and structural elements outside shadow DOM.
 */
const KM_SURFACES = `
  --km-surface: #131313;
  --km-surface-dim: #0e0e0e;
  --km-surface-low: #1c1b1b;
  --km-surface-container: #201f1f;
  --km-surface-high: #2a2a2a;
  --km-surface-highest: #353534;
  --km-surface-bright: #3a3939;
  --km-surface-tint: #1ce388;
  --km-on-surface: #e5e2e1;
  --km-on-surface-variant: #bacbbc;
  --km-outline-variant: #3c4a3f;
  --km-font-headline: 'Manrope', system-ui, sans-serif;
  --km-font-body: 'Inter', system-ui, sans-serif;
`

/** Admin layout and component CSS — injected into <style> on admin pages. */
export const ADMIN_THEME_CSS: string = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Inter:wght@400;500;600&display=swap');

:root { ${KM_SURFACES} }

*, *::before, *::after { box-sizing: border-box; margin: 0; }

body {
  background: var(--km-surface);
  color: var(--km-on-surface);
  font-family: var(--km-font-body);
  font-size: 0.875rem;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

::selection {
  background: oklch(0.90 0.19 159.5);
  color: #00391d;
}

/* --- Kinetic Background --- */
.km-kinetic-bg {
  position: fixed;
  inset: 0;
  background:
    radial-gradient(circle at 0% 0%, var(--km-surface-low) 0%, transparent 50%),
    radial-gradient(circle at 100% 100%, var(--km-surface) 0%, transparent 50%);
  z-index: -2;
}

.km-glow {
  position: fixed;
  border-radius: 9999px;
  filter: blur(120px);
  z-index: -1;
  pointer-events: none;
}

.km-glow-primary {
  top: 5rem; right: 15%;
  width: 400px; height: 400px;
  background: oklch(0.90 0.19 159.5 / 0.05);
}

.km-glow-tertiary {
  bottom: 5rem; left: 10%;
  width: 300px; height: 300px;
  background: oklch(0.89 0.06 264.05 / 0.05);
}

/* --- Accent Line --- */
.km-accent-line {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 2px;
  background: linear-gradient(to right, transparent, #1ce388, transparent);
  opacity: 0.5;
}

/* --- Card (Level 2 surface) --- */
.km-card {
  position: relative;
  background: var(--km-surface-container);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 25px 60px -10px oklch(0 0 0 / 0.6), 0 10px 20px -5px oklch(0 0 0 / 0.3);
  overflow: hidden;
}

/* --- Labels (uppercase tracked) --- */
.km-label {
  font-family: var(--km-font-body);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--km-on-surface-variant);
}

/* --- Field Header (label + forgot link) --- */
.login-field-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.km-forgot-link {
  font-size: 0.75rem;
  font-weight: 600;
  color: oklch(0.90 0.19 159.5);
  text-decoration: none;
}

.km-forgot-link:hover {
  text-decoration: underline;
}

/* --- Error --- */
.km-error {
  margin-bottom: 1.5rem;
  padding: 0.75rem 1rem;
  background: oklch(0.40 0.13 25.72 / 0.15);
  border-left: 2px solid oklch(0.64 0.21 25.33);
  color: oklch(0.81 0.10 19.57);
  font-size: 0.875rem;
}

/* --- ValElement overrides for Kinetic Monolith ---
   CSS custom properties pierce shadow DOM, so we can restyle
   ValElements from the page level without touching their source. */
val-input {
  --val-color-bg-elevated: #353534;
  --val-color-border: transparent;
  --val-color-border-focus: oklch(0.90 0.19 159.5);
  --val-color-text: #e5e2e1;
  --val-color-text-muted: #bacbbc;
  --val-focus-ring: inset 0 0 0 1px oklch(0.90 0.19 159.5 / 0.1);
}

val-button.km-gradient-btn {
  --val-font-sans: var(--km-font-headline);
  --val-weight-medium: 800;
  --val-text-sm: 0.875rem;
  --val-radius-md: 0.125rem;
  --val-space-2: 1rem;
  --val-space-4: 1rem;
}

/* --- Status Dot --- */
.km-status-dot {
  width: 6px; height: 6px;
  border-radius: 9999px;
  background: oklch(0.90 0.19 159.5);
  animation: km-pulse 2s ease-in-out infinite;
}

@keyframes km-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`

/** Returns the admin layout CSS for <style> injection. */
export function getAdminStyles (): string {
  return ADMIN_THEME_CSS
}
