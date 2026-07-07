# @valencets/plugin-nested-docs — Agent Guide

CMS plugin (config transformer, peer dep on `@valencets/cms`). `nestedDocsPlugin(opts)` injects into
targeted collections: a self-referencing `parent` relation field, a `breadcrumbs` json field, and an
`afterChange` hook that writes the breadcrumb trail (field names configurable via `parentField`/
`breadcrumbField`/`labelField`). Idempotent: skips collections that already carry the fields.
Pure config transformation — no runtime service. Repo-wide rules: root `AGENTS.md`.
