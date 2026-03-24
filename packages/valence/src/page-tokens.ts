/**
 * Embeddable CSS token definitions for standalone HTML pages (learn, landing).
 * These pages are always dark-themed, so we set semantic tokens to dark values directly.
 * Values come from @valencets/ui primitives.css + semantic.css dark mode.
 * Source: packages/ui/src/tokens/primitives.css and packages/ui/src/tokens/semantic.css
 * If token values change in the source CSS files, update these values to match.
 */
export const PAGE_TOKEN_CSS = `
  :root {
    /* --- Gray scale (from @valencets/ui primitives.css) --- */
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

    /* --- Blue scale (from @valencets/ui primitives.css) --- */
    --val-blue-400: oklch(0.7137 0.1434 254.62);
    --val-blue-500: oklch(0.6231 0.1880 259.81);
    --val-blue-600: oklch(0.5461 0.2152 262.88);
    --val-blue-700: oklch(0.4882 0.2172 264.38);

    /* --- Green scale (from @valencets/ui primitives.css) --- */
    --val-green-400: oklch(0.8003 0.1821 151.71);
    --val-green-500: oklch(0.7227 0.1920 149.58);
    --val-green-600: oklch(0.6271 0.1699 149.21);

    /* --- Typography (from @valencets/ui primitives.css) --- */
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
    --val-text-5xl: 3rem;

    --val-leading-tight: 1.25;
    --val-leading-normal: 1.5;
    --val-leading-relaxed: 1.75;

    --val-weight-normal: 400;
    --val-weight-medium: 500;
    --val-weight-semibold: 600;
    --val-weight-bold: 700;

    /* --- Spacing (from @valencets/ui primitives.css) --- */
    --val-space-0: 0;
    --val-space-1: 0.25rem;
    --val-space-2: 0.5rem;
    --val-space-3: 0.75rem;
    --val-space-4: 1rem;
    --val-space-5: 1.25rem;
    --val-space-6: 1.5rem;
    --val-space-8: 2rem;
    --val-space-10: 2.5rem;
    --val-space-12: 3rem;
    --val-space-16: 4rem;
    --val-space-20: 5rem;
    --val-space-24: 6rem;

    /* --- Border radius (from @valencets/ui primitives.css) --- */
    --val-radius-sm: 0.25rem;
    --val-radius-md: 0.375rem;
    --val-radius-lg: 0.5rem;
    --val-radius-full: 9999px;

    /* --- Shadows (from @valencets/ui primitives.css) --- */
    --val-shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.05);
    --val-shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
    --val-shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1);

    /* --- Duration (from @valencets/ui primitives.css) --- */
    --val-duration-fast: 100ms;
    --val-duration-normal: 200ms;
    --val-duration-slow: 300ms;

    /* --- Easing (from @valencets/ui primitives.css) --- */
    --val-ease-in: cubic-bezier(0.4, 0, 1, 1);
    --val-ease-out: cubic-bezier(0, 0, 0.2, 1);
    --val-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

    /* --- Semantic tokens: dark mode (from @valencets/ui semantic.css) --- */
    --val-color-bg: var(--val-gray-950);
    --val-color-bg-elevated: var(--val-gray-900);
    --val-color-bg-muted: var(--val-gray-800);
    --val-color-text: var(--val-gray-50);
    --val-color-text-muted: var(--val-gray-400);
    --val-color-text-inverted: oklch(1 0 0);
    --val-color-primary: var(--val-blue-600);
    --val-color-primary-hover: var(--val-blue-700);
    --val-color-primary-text: oklch(1 0 0);
    --val-color-success: var(--val-green-500);
    --val-color-border: var(--val-gray-700);
    --val-color-border-focus: var(--val-blue-500);
    --val-focus-ring: 0 0 0 2px var(--val-color-bg), 0 0 0 4px var(--val-color-border-focus);
  }
`
