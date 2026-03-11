# packages/tokens

Design token engine driving PostCSS/Tailwind for all Inertia client sites. Adapts the Onyx token + variant architecture to vanilla Web Components.

## Module Map

```
src/
├── token-types.ts     # TokenErrorCode, ThemeConfig, ColorSet, ShadowSet types
├── schema.ts          # Zod schema + parseTheme() / parsePartialTheme()
├── resolve.ts         # Merge client partial → base → resolved ThemeConfig
├── generate.ts        # ThemeConfig → CSS string (@theme inline + :root + .dark)
├── variants.ts        # cn() utility, re-export tv/VariantProps
├── index.ts           # Barrel exports
└── __tests__/
    ├── schema.test.ts
    ├── resolve.test.ts
    ├── generate.test.ts
    └── variants.test.ts
```

## Token Architecture

Two-tier CSS variable system:
1. `:root`/`.dark` define raw tokens (`--primary`, `--background`, etc.)
2. `@theme inline` maps them to Tailwind namespace (`--color-primary: var(--primary)`)

Dark mode via `.dark` class, not `prefers-color-scheme`.

## Variant System

`tailwind-variants` (`tv()`) is the variant engine. Framework-agnostic — works with Web Components via `cn(buttonVariants({ variant, size }))` in `connectedCallback`.

## Key Patterns

- `.safeParse()` only (never `.parse()`)
- `neverthrow` Result monads for all validation functions
- No `try/catch` in business logic
- No `switch` statements — use dictionary maps
- Named exports only, no defaults
- `base.json` provides neutral fallback; client sites override via PartialTheme

## TDD Protocol

Write tests BEFORE implementation. Every feature follows red-green-refactor.

### LOC Targets

| Module | Impl LOC | Test LOC |
|--------|----------|----------|
| `token-types.ts` | ~60 | — |
| `schema.ts` | ~80 | ~80 |
| `resolve.ts` | ~20 | ~60 |
| `generate.ts` | ~120 | ~100 |
| `variants.ts` | ~10 | ~60 |
| `base.json` | ~120 | — |
| `index.ts` | ~10 | — |

## Development Order

token-types → schema → resolve → generate → variants → base.json → barrel exports
