# @valencets/ui — Agent Guide

23 dependency-free Web Components + design tokens. Zero runtime deps (optional Tailwind peer for the
preset). Repo-wide rules: root `AGENTS.md`.

## Module map

```
src/
├── core/
│   ├── val-element.ts       # ValElement base: shadow DOM + ElementInternals, template clone-once,
│   │                        # hydration directives (hydrate:load|idle|visible|media), locale observer,
│   │                        # entity watching, telemetry interaction events
│   ├── val-form-element.ts  # form-associated base (value/checked contract for bind())
│   ├── interaction-emitter.ts, locale-observer.ts, resolve-space.ts
├── components/              # val-button, val-input, val-select, val-checkbox, val-toggle, val-textarea,
│                            # val-dialog, val-tabs, val-table, val-nav, val-card, val-badge, val-heading,
│                            # val-text, val-form, val-grid, val-stack, val-section, val-sidebar,
│                            # val-spinner, val-autosave, val-bulk-bar, val-preview-pane
│                            # register.ts does customElements.define — classes are import-only for tree-shaking
├── tokens/
│   ├── token-sheets.ts      # primitives.css (51 OKLCH colors, spacing, type, radii, shadows) + semantic.css
│   ├── theme-contract.ts    # THEME_TOKENS_REQUIRED / THEME_TOKENS_DARK, validateTheme()
│   └── theme-manager.ts     # light/dark via <html data-theme>
├── tailwind/preset.ts       # maps --val-* tokens to Tailwind theme (plain object, zero imports)
└── entity-store.ts          # client-side entity cache components can watch
```

## Hard rules

- Zero dependencies. Nothing imported from other workspace packages either.
- Components use only **semantic** tokens (`--val-color-*`), never primitives or hardcoded colors.
- Every component: ARIA roles/states via ElementInternals where applicable, keyboard operable,
  `part` attributes for external styling, locale-aware text via the locale observer.
- Hydration directives keep components inert until their condition fires — don't do work in the
  constructor; `connectedCallback` is gated by `ValElement`.
- `.stories.ts` files are Storybook-style docs, not shipped behavior.
- Tests (happy-dom): dynamic-import the component in `beforeAll` so registration happens inside the
  test environment; one tag name per process.
