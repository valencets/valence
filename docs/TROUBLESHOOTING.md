# Troubleshooting

Common issues and fixes. This document grows over time.

## Build order issues

**Symptom**: TypeScript errors referencing types from another package, or missing module errors at runtime.

**Cause**: Packages have a dependency graph. If package A depends on package B, B must build first.

**Fix**: `pnpm build` runs `pnpm -r run build`, which respects workspace dependency order. If you are building a single package, ensure its dependencies are built first:

```bash
# Build a specific package and its dependencies
pnpm build --filter=@valencets/telemetry
```

The dependency graph:
```
core                (depends on neverthrow)
db                  (depends on neverthrow, postgres, zod)
telemetry           (depends on db, neverthrow, postgres)
ui                  (standalone)
cms                 (depends on core, db, ui, zod)
```

Build order (topological): core, db, ui (parallel) -> telemetry -> cms

## Pre-commit hook failures

**Symptom**: `git commit` is rejected by the Husky pre-commit hook.

**Cause**: The pre-commit hook runs `pnpm lint`, which enforces Neostandard rules via ESLint 9.

**Fix**:
1. Read the error message -- it tells you which rule was violated, in which file, at which line
2. Fix the lint violation
3. Stage the fix and commit again

You can run the same checks directly:

```bash
pnpm exec eslint path/to/file.ts --fix
bash scripts/check-banned-patterns.sh
bash -n .husky/pre-commit .husky/pre-push .husky/commit-msg scripts/*.sh
```

`git push` runs the heavier `pre-push` gate: `pnpm validate && pnpm test:smoke`.

### Common lint violations

| You wrote | Fix |
|-----------|-----|
| Missing semicolon or extra semicolon | Follow Neostandard conventions (no semicolons by default) |
| Unused variable | Remove or prefix with `_` |
| `export default function` | Use named export: `export function myFunction` |
| Trailing whitespace | Remove it |

## TypeScript strict mode errors

**Symptom**: Type errors that seem overly strict, like `undefined` not being assignable or index access returning `T | undefined`.

**Cause**: The root `tsconfig.json` enables strict mode with aggressive flags:

- `noUncheckedIndexedAccess` -- array/object index access returns `T | undefined`
- `exactOptionalPropertyTypes` -- `undefined` is not assignable to optional properties unless explicitly included in the type
- `noImplicitReturns` -- every code path must explicitly return

**Fix**: Handle the types explicitly. For indexed access, narrow with a check:

```ts
const value = myArray[index]
if (value === undefined) return err({ code: 'NOT_FOUND', message: 'missing' })
// value is now narrowed to T
```

## Missing workspace dependency

**Symptom**: Import from `@valencets/foo` fails with "Cannot find module" at build or runtime.

**Fix**:
1. Check that the dependency is listed in the consuming package's `package.json`:
   ```json
   "dependencies": {
     "@valencets/foo": "workspace:*"
   }
   ```
2. Run `pnpm install` to link the workspace dependency
3. Run `pnpm build` to ensure the dependency's `dist/` is populated

## Test failures in happy-dom

**Symptom**: Tests pass locally but fail in CI, or Web Component tests fail with registration errors.

**Cause**: Web Components registered via `customElements.define()` persist across tests in the same process. If two test files register the same tag name, the second will throw.

**Fix**: Use the `beforeAll` dynamic import pattern to ensure components register in the happy-dom environment:

```ts
let MyComponent: typeof import('../MyComponent.js').MyComponent
beforeAll(async () => {
  const mod = await import('../MyComponent.js')
  MyComponent = mod.MyComponent
})
```

This ensures the component is registered exactly once per test file.

## Migration runner errors

**Symptom**: Application boot fails during the migration step.

**Checks**:
1. Is the SQL valid? Run the migration manually against your database
2. Is it idempotent? Use `IF NOT EXISTS` / `IF EXISTS` guards
3. The migration runner returns `Result` -- check the error code and message from the `Err` branch
4. Check that the `_migrations` tracking table exists and has not been corrupted

## pnpm workspace resolution

**Symptom**: `pnpm install` fails with workspace protocol errors.

**Fix**:
1. Ensure `pnpm-workspace.yaml` contains `packages: ["packages/*"]`
2. Ensure each package's `package.json` uses `"workspace:*"` for internal dependencies
3. Run `pnpm install` from the repository root, not from inside a package directory
