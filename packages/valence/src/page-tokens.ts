/**
 * Embeddable CSS token definitions for standalone HTML pages (learn, landing).
 * These pages are always dark-themed, so we set semantic tokens to dark values directly.
 * Values come from @valencets/ui primitives.css + semantic.css dark mode.
 * Source: packages/ui/src/tokens/primitives.css and packages/ui/src/tokens/semantic.css
 * If token values change in the source CSS files, update these values to match.
 */
export const PAGE_TOKEN_CSS = `
  :root {
    --val-gray-200: oklch(0.9276 0.0058 264.53);
    --val-gray-400: oklch(0.7137 0.0192 261.32);
    --val-gray-500: oklch(0.5510 0.0234 264.36);
    --val-gray-600: oklch(0.4461 0.0263 256.80);
    --val-gray-700: oklch(0.3729 0.0306 259.73);
    --val-gray-800: oklch(0.2781 0.0296 256.85);
    --val-gray-900: oklch(0.2101 0.0318 264.66);
    --val-gray-950: oklch(0.1296 0.0274 261.69);
    --val-blue-400: oklch(0.7137 0.1434 254.62);
    --val-blue-500: oklch(0.6231 0.1880 259.81);
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
    --val-text-5xl: 3rem;
    --val-space-1: 0.25rem;
    --val-space-2: 0.5rem;
    --val-space-3: 0.75rem;
    --val-space-4: 1rem;
    --val-space-5: 1.25rem;
    --val-space-6: 1.5rem;
    --val-space-8: 2rem;
    --val-space-10: 2.5rem;
    --val-radius-sm: 0.25rem;
    --val-radius-md: 0.375rem;
    --val-radius-lg: 0.5rem;
    --val-duration-fast: 100ms;
    --val-duration-normal: 200ms;
    --val-color-bg: var(--val-gray-950);
    --val-color-bg-elevated: var(--val-gray-800);
    --val-color-text: var(--val-gray-200);
    --val-color-text-muted: var(--val-gray-400);
    --val-color-primary: var(--val-blue-500);
    --val-color-primary-hover: var(--val-blue-400);
    --val-color-success: var(--val-green-500);
    --val-color-border: var(--val-gray-700);
  }
`
