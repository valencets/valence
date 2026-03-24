# Getting Started

Clone, install, build, verify -- in under 5 minutes.

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | >= 22.0.0 | `node -v` |
| pnpm | 10.30.x | `pnpm -v` |

## Install

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
```

## Build

```bash
pnpm build
```

This runs `tsc` in every package respecting topological dependency order. Each package emits to its own `dist/` directory.

## Run Tests

```bash
pnpm test              # all workspaces
pnpm test --filter=@valencets/core       # core only
pnpm test --filter=@valencets/db         # db only
pnpm test --filter=@valencets/telemetry  # telemetry only
```

Tests use Vitest with happy-dom. No database or network required. 315 tests across the monorepo, all passing.

## Lint

```bash
pnpm lint
```

Neostandard via ESLint 9. The pre-commit hook runs `lint-staged`, which applies ESLint to staged code files instead of linting the entire repo.

## Validate

```bash
pnpm validate
```

Runs typecheck (`pnpm build`) followed by lint. This is the full CI gate.

## All Root Scripts

| Script | What it does |
|--------|-------------|
| `pnpm build` | Build all packages (`tsc` across workspaces) |
| `pnpm test` | Run all tests |
| `pnpm test:ci` | Run tests with concurrency limit (CI) |
| `pnpm lint` | ESLint with Neostandard |
| `pnpm typecheck` | Alias for `pnpm build` |
| `pnpm validate` | Typecheck + lint |

## Next Steps

- Read [ARCHITECTURE.md](./ARCHITECTURE.md) for the engineering philosophy and system design
- Read [DEVELOPER-GUIDE.md](./DEVELOPER-GUIDE.md) for day-to-day development patterns
- Read [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and fixes
