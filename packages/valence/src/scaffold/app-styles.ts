export function generateAppStyles (): string {
  return `/* @generated — regenerated from valence.config.ts. DO NOT EDIT. */

/* Valence design tokens — dark theme */
:root {
  --val-gray-50: oklch(0.9846 0.0017 247.84);
  --val-gray-100: oklch(0.9670 0.0029 264.54);
  --val-gray-200: oklch(0.9276 0.0058 264.53);
  --val-gray-300: oklch(0.8717 0.0093 258.34);
  --val-gray-400: oklch(0.7137 0.0192 261.32);
  --val-gray-500: oklch(0.5510 0.0234 264.36);
  --val-gray-600: oklch(0.4461 0.0263 256.80);
  --val-gray-700: oklch(0.3729 0.0306 259.73);
  --val-gray-800: oklch(0.2781 0.0296 256.85);
  --val-gray-900: oklch(0.2101 0.0318 264.66);
  --val-gray-950: oklch(0.1296 0.0274 261.69);

  --val-blue-400: oklch(0.7137 0.1434 254.62);
  --val-blue-500: oklch(0.6231 0.1880 259.81);
  --val-blue-600: oklch(0.5461 0.2152 262.88);
  --val-blue-700: oklch(0.4882 0.2172 264.38);

  --val-red-500: oklch(0.6368 0.2078 25.33);
  --val-green-500: oklch(0.7227 0.1920 149.58);

  --val-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --val-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  --val-text-xs: 0.75rem;
  --val-text-sm: 0.875rem;
  --val-text-base: 1rem;
  --val-text-lg: 1.125rem;
  --val-text-xl: 1.25rem;
  --val-text-2xl: 1.5rem;
  --val-text-3xl: 1.875rem;
  --val-text-4xl: 2.25rem;

  --val-leading-tight: 1.25;
  --val-leading-normal: 1.5;
  --val-leading-relaxed: 1.625;

  --val-weight-normal: 400;
  --val-weight-medium: 500;
  --val-weight-semibold: 600;
  --val-weight-bold: 700;

  --val-space-1: 0.25rem;
  --val-space-2: 0.5rem;
  --val-space-3: 0.75rem;
  --val-space-4: 1rem;
  --val-space-6: 1.5rem;
  --val-space-8: 2rem;

  --val-radius-sm: 0.25rem;
  --val-radius-md: 0.375rem;
  --val-radius-lg: 0.5rem;

  --val-shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.05);
  --val-shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);

  --val-duration-fast: 100ms;
  --val-duration-normal: 200ms;

  /* Semantic tokens — dark */
  --val-color-bg: var(--val-gray-950);
  --val-color-bg-elevated: var(--val-gray-900);
  --val-color-bg-muted: var(--val-gray-800);
  --val-color-text: var(--val-gray-50);
  --val-color-text-muted: var(--val-gray-400);
  --val-color-primary: var(--val-blue-500);
  --val-color-primary-hover: var(--val-blue-400);
  --val-color-border: var(--val-gray-700);
  --val-color-error: var(--val-red-500);
  --val-color-success: var(--val-green-500);
}

/* Reset */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--val-font-sans);
  font-size: var(--val-text-base);
  line-height: var(--val-leading-normal);
  color: var(--val-color-text);
  background: var(--val-color-bg);
  -webkit-font-smoothing: antialiased;
}

code {
  font-family: var(--val-font-mono);
  font-size: 0.875em;
  background: var(--val-color-bg-elevated);
  padding: 0.125rem 0.375rem;
  border-radius: var(--val-radius-sm);
}

a { color: var(--val-color-primary); text-decoration: none; }
a:hover { color: var(--val-color-primary-hover); }
`
}
