import { build } from 'esbuild'
import { join } from 'node:path'

export async function bundleClientJS (studioRoot: string): Promise<void> {
  const entryPoints = [
    join(studioRoot, 'features', 'client', 'boot-entry.ts')
  ]

  await build({
    entryPoints,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    outfile: join(studioRoot, 'public', 'js', 'boot.js')
  })
}

export async function bundleAdminJS (studioRoot: string): Promise<void> {
  const entryPoints = [
    join(studioRoot, 'features', 'client', 'admin-entry.ts')
  ]

  await build({
    entryPoints,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    minify: true,
    outfile: join(studioRoot, 'public', 'js', 'admin.js')
  })
}
