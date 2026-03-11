# tools/critical-css

Critical CSS extraction tool enforcing Pillar #4: 14kB Protocol Limit.

## Module Map

```
src/
├── types.ts               # CriticalCSSErrorCode, SplitResult, BudgetReport, ExtractedSelectors
├── extract-selectors.ts   # HTML string → Set<string> of classes, IDs, elements
├── split-css.ts           # PostCSS AST walk: full CSS + selectors → { critical, deferred }
├── budget-audit.ts        # gzip compressed size measurement, 14kB compliance
├── index.ts               # extractCriticalCSS convenience + barrel exports
└── __tests__/
    ├── extract-selectors.test.ts
    ├── split-css.test.ts
    ├── budget-audit.test.ts
    └── integration.test.ts
```

## Key Patterns

- `fromThrowable` for PostCSS parse and gzip boundaries (no try/catch)
- `neverthrow` Result monads for all public functions
- Dictionary map classifier for CSS rule categorization (no switch)
- Regex for HTML class/id/element extraction (no htmlparser2)

## Dependencies

- `postcss` — CSS AST parsing and walking
- `neverthrow` — Result monads
- `zlib` (Node built-in) — gzip compression for budget audit

## TDD Protocol

Write tests BEFORE implementation. Every feature follows red-green-refactor.

### LOC Targets

| Module | Impl LOC | Test LOC |
|--------|----------|----------|
| `types.ts` | ~40 | — |
| `extract-selectors.ts` | ~50 | ~120 |
| `split-css.ts` | ~100 | ~200 |
| `budget-audit.ts` | ~60 | ~100 |
| `index.ts` | ~30 | ~80 |
