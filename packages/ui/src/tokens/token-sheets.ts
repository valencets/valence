// Constructable Stylesheets for design token delivery.
// Replaces CSS custom property injection on :root with adoptable CSSStyleSheet instances.

/** Create a CSSStyleSheet from a CSS text string. */
export function createTokenSheet (cssText: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(cssText)
  return sheet
}

/** Shared primitive tokens — identical in light and dark themes. */
const PRIMITIVES_CSS =
  `  /* --- Gray scale --- */
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

  /* --- Blue scale --- */
  --val-blue-50: oklch(0.9705 0.0142 254.60);
  --val-blue-100: oklch(0.9319 0.0316 255.59);
  --val-blue-200: oklch(0.8823 0.0571 254.13);
  --val-blue-300: oklch(0.8091 0.0956 251.81);
  --val-blue-400: oklch(0.7137 0.1434 254.62);
  --val-blue-500: oklch(0.6231 0.1880 259.81);
  --val-blue-600: oklch(0.5461 0.2152 262.88);
  --val-blue-700: oklch(0.4882 0.2172 264.38);
  --val-blue-800: oklch(0.4244 0.1809 265.64);
  --val-blue-900: oklch(0.3791 0.1378 265.52);

  /* --- Red scale --- */
  --val-red-50: oklch(0.9705 0.0129 17.38);
  --val-red-100: oklch(0.9356 0.0309 17.72);
  --val-red-200: oklch(0.8845 0.0593 18.33);
  --val-red-300: oklch(0.8077 0.1035 19.57);
  --val-red-400: oklch(0.7106 0.1661 22.22);
  --val-red-500: oklch(0.6368 0.2078 25.33);
  --val-red-600: oklch(0.5771 0.2152 27.33);
  --val-red-700: oklch(0.5054 0.1905 27.52);
  --val-red-800: oklch(0.4437 0.1613 26.90);
  --val-red-900: oklch(0.3958 0.1331 25.72);

  /* --- Green scale --- */
  --val-green-50: oklch(0.9819 0.0181 155.83);
  --val-green-100: oklch(0.9624 0.0434 156.74);
  --val-green-200: oklch(0.9250 0.0806 155.99);
  --val-green-300: oklch(0.8712 0.1363 154.45);
  --val-green-400: oklch(0.8003 0.1821 151.71);
  --val-green-500: oklch(0.7227 0.1920 149.58);
  --val-green-600: oklch(0.6271 0.1699 149.21);
  --val-green-700: oklch(0.5273 0.1371 150.07);
  --val-green-800: oklch(0.4479 0.1083 151.33);
  --val-green-900: oklch(0.3925 0.0896 152.54);

  /* --- Amber scale --- */
  --val-amber-50: oklch(0.9869 0.0214 95.28);
  --val-amber-100: oklch(0.9619 0.0580 95.62);
  --val-amber-200: oklch(0.9243 0.1151 95.75);
  --val-amber-300: oklch(0.8790 0.1534 91.61);
  --val-amber-400: oklch(0.8369 0.1644 84.43);
  --val-amber-500: oklch(0.7686 0.1647 70.08);
  --val-amber-600: oklch(0.6658 0.1574 58.32);
  --val-amber-700: oklch(0.5553 0.1455 49.00);
  --val-amber-800: oklch(0.4732 0.1247 46.20);
  --val-amber-900: oklch(0.4137 0.1054 45.90);

  /* --- Spacing (4px base) --- */
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

  /* --- Typography --- */
  --val-font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --val-font-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  /* Modular type scale (1.25 ratio) */
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

  /* --- Border radius --- */
  --val-radius-sm: 0.25rem;
  --val-radius-md: 0.375rem;
  --val-radius-lg: 0.5rem;
  --val-radius-full: 9999px;

  /* --- Shadows --- */
  --val-shadow-sm: 0 1px 2px 0 oklch(0 0 0 / 0.05);
  --val-shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
  --val-shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1);

  /* --- Duration --- */
  --val-duration-fast: 100ms;
  --val-duration-normal: 200ms;
  --val-duration-slow: 300ms;

  /* --- Easing --- */
  --val-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --val-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --val-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
`

/** Light semantic overrides — surface, text, interactive, feedback, border. */
const LIGHT_SEMANTIC_CSS =
  `  /* --- Surface (light) --- */
  --val-color-bg: var(--val-gray-50);
  --val-color-bg-elevated: oklch(1 0 0);
  --val-color-bg-muted: var(--val-gray-100);

  /* --- Text (light) --- */
  --val-color-text: var(--val-gray-900);
  --val-color-text-muted: var(--val-gray-500);
  --val-color-text-inverted: oklch(1 0 0);

  /* --- Interactive --- */
  --val-color-primary: var(--val-blue-600);
  --val-color-primary-hover: var(--val-blue-700);
  --val-color-primary-text: oklch(1 0 0);

  /* --- Feedback --- */
  --val-color-error: var(--val-red-500);
  --val-color-success: var(--val-green-500);
  --val-color-warning: var(--val-amber-500);

  /* --- Border + Focus --- */
  --val-color-border: var(--val-gray-200);
  --val-color-border-focus: var(--val-blue-500);
  --val-focus-ring: 0 0 0 2px var(--val-color-bg), 0 0 0 4px var(--val-color-border-focus);
}`

/** Dark semantic overrides — inverted surface and text, adjusted borders. */
const DARK_SEMANTIC_CSS =
  `  /* --- Surface (dark) --- */
  --val-color-bg: var(--val-gray-950);
  --val-color-bg-elevated: var(--val-gray-900);
  --val-color-bg-muted: var(--val-gray-800);

  /* --- Text (dark) --- */
  --val-color-text: var(--val-gray-50);
  --val-color-text-muted: var(--val-gray-400);
  --val-color-text-inverted: oklch(1 0 0);

  /* --- Interactive --- */
  --val-color-primary: var(--val-blue-600);
  --val-color-primary-hover: var(--val-blue-700);
  --val-color-primary-text: oklch(1 0 0);

  /* --- Feedback --- */
  --val-color-error: var(--val-red-500);
  --val-color-success: var(--val-green-500);
  --val-color-warning: var(--val-amber-500);

  /* --- Border (dark) --- */
  --val-color-border: var(--val-gray-700);
  --val-color-border-focus: var(--val-blue-500);
  --val-focus-ring: 0 0 0 2px var(--val-color-bg), 0 0 0 4px var(--val-color-border-focus);
}`

/** Light theme tokens — :host scopes to shadow roots, :root to document level. */
export const LIGHT_TOKENS_CSS = ':host, :root {\n' + PRIMITIVES_CSS + LIGHT_SEMANTIC_CSS + '\n}\n'

/** Dark theme tokens — :host scopes to shadow roots, :root to document level. */
export const DARK_TOKENS_CSS = ':host, :root {\n' + PRIMITIVES_CSS + DARK_SEMANTIC_CSS + '\n}\n'

/** Pre-built light token sheet singleton. */
export const lightTokenSheet: CSSStyleSheet = createTokenSheet(LIGHT_TOKENS_CSS)

/** Pre-built dark token sheet singleton. */
export const darkTokenSheet: CSSStyleSheet = createTokenSheet(DARK_TOKENS_CSS)

/**
 * Merge multiple stylesheets into a new sheet, preserving cascade order.
 * Later sheets override earlier ones.
 */
export function mergeTokenSheets (...sheets: ReadonlyArray<CSSStyleSheet>): CSSStyleSheet {
  const parts: Array<string> = []
  for (const sheet of sheets) {
    for (let i = 0; i < sheet.cssRules.length; i++) {
      const rule = sheet.cssRules[i]
      if (rule !== undefined) {
        parts.push(rule.cssText)
      }
    }
  }
  return createTokenSheet(parts.join('\n'))
}
