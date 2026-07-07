# @valencets/plugin-cloud-storage — Agent Guide

CMS plugin providing an S3-compatible `StorageAdapter` for media uploads (deps: `@aws-sdk/client-s3`,
`@valencets/resultkit`; peer dep on `@valencets/cms`). `s3-adapter.ts` implements the cms
`media/storage-adapter.ts` contract with Result-based errors and key sanitization (path traversal
protection applies to object keys too). Repo-wide rules: root `AGENTS.md`.
