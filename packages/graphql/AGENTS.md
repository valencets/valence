# @valencets/graphql — Agent Guide

GraphQL endpoint derived from CMS collections. Deps: `@valencets/cms`, `graphql`, `@valencets/resultkit`.
Enabled via `graphql: true` in `valence.config.ts`. Repo-wide rules: root `AGENTS.md`.

## Modules

- `type-builder.ts` — `fieldToGraphQLType`: FieldConfig → GraphQL type (scalars, lists, nested objects).
- `schema-generator.ts` — `generateGraphQLSchema`: collections → SDL with per-collection Query fields
  (singular by id, plural with filters) and CRUD Mutations. `singularize`/`capitalize` naming helpers —
  keep in sync with codegen naming in `@valencets/valence`.
- `resolver-builder.ts` — `buildCollectionResolvers`: resolvers delegate to the CMS **Local API**, so
  validation, hooks, and access control are identical to REST. Never query the pool directly here.
- `handler.ts` — `createGraphQLHandler`/`createGraphQLRoutes`: `POST /graphql`, body-limited,
  Result-based error mapping to GraphQL errors.

## Hard rules

- All data access goes through the Local API — bypassing it would skip access control and hooks.
- Errors surface as GraphQL `errors` entries, never thrown.
