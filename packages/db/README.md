# @valencets/db

PostgreSQL query layer. Tagged template SQL that is parameterized by default, `Result<T, E>` returns on every operation, and a migration runner for schema changes. Zero dependencies besides @valencets/resultkit, postgres, and zod.

38 tests. [Full documentation on the wiki.](https://github.com/valencets/valence/wiki/Packages:-Db)

## Quick Start

```bash
pnpm install
pnpm build
pnpm --filter=@valencets/db test
```
