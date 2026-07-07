# @valencets/plugin-seo — Agent Guide

CMS plugin (config transformer, peer dep on `@valencets/cms`). `seoPlugin(opts)` returns
`(config: CmsConfig) => CmsConfig` that appends an `seo` group (metaTitle, metaDescription, ogImage,
noIndex) to targeted collections and optionally a `beforeChange` auto-title hook
(`titleField` + `defaults.metaTitleSuffix`). Idempotent: skips collections that already have an
`seo` field. Repo-wide rules: root `AGENTS.md`.
