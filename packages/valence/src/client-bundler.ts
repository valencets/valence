import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { context } from 'esbuild'
import type { BuildContext, BuildResult, Message } from 'esbuild'
import { ResultAsync } from '@valencets/resultkit'
import type { RouteHandler } from './define-config.js'

/** Framework-owned URL the bundled client entry is served from. */
export const CLIENT_BUNDLE_PATH = '/_valence/client.js'

const ENTRY_CANDIDATES = [
  join('src', 'app', 'client.ts'),
  join('src', 'app', 'client.js')
]

export interface ClientBundle {
  readonly js: string
  readonly etag: string
}

export interface ClientBundler {
  /** Latest good bundle — null before the first successful build. */
  readonly getBundle: () => ClientBundle | null
  readonly dispose: () => Promise<void>
}

export interface ClientBundlerOptions {
  readonly projectDir: string
  /** Watch the entry and rebuild on change (dev); one-shot otherwise. */
  readonly watch: boolean
  readonly log?: (msg: string) => void
}

export interface BundleError {
  readonly message: string
}

/**
 * The conventional client entry — the app-layer module that boots stores
 * (initStores) and any other browser code. Returns null when the project
 * ships no client code, which disables the bundle route entirely.
 */
export function resolveClientEntry (projectDir: string): string | null {
  for (const candidate of ENTRY_CANDIDATES) {
    const path = join(projectDir, candidate)
    if (existsSync(path)) return path
  }
  return null
}

function formatMessages (messages: readonly Message[]): string {
  return messages.map(m => m.location ? `${m.location.file}:${m.location.line} ${m.text}` : m.text).join('; ')
}

/**
 * Bundles the client entry with esbuild into a single browser ESM file,
 * kept in memory and content-hashed for ETag revalidation. Build failures
 * never take the server down: the last good bundle keeps serving and the
 * error is logged; before any good build the route answers 503.
 */
export function createClientBundler (options: ClientBundlerOptions): ResultAsync<ClientBundler, BundleError> {
  const log = options.log ?? (() => {})
  const entry = resolveClientEntry(options.projectDir)

  let current: ClientBundle | null = null
  let buildContext: BuildContext | null = null

  const capture = (result: BuildResult): void => {
    if (result.errors.length > 0) {
      log(`client bundle failed: ${formatMessages(result.errors)}`)
      return
    }
    const output = result.outputFiles?.[0]
    if (!output) return
    const js = output.text
    current = { js, etag: `"${createHash('sha256').update(js).digest('hex').slice(0, 32)}"` }
  }

  return ResultAsync.fromPromise(
    (async (): Promise<ClientBundler> => {
      if (entry === null) {
        return {
          getBundle: () => null,
          dispose: async () => {}
        }
      }

      buildContext = await context({
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        platform: 'browser',
        target: 'es2022',
        sourcemap: options.watch ? 'inline' : false,
        minify: !options.watch,
        write: false,
        outfile: 'client.js',
        absWorkingDir: options.projectDir,
        logLevel: 'silent',
        plugins: [{
          name: 'valence-capture',
          setup (build) {
            build.onEnd((result) => { capture(result) })
          }
        }]
      })

      // rebuild() rejects on compile errors — onEnd has already logged
      // them, so a failed first build leaves current at null and the
      // bundler alive (watch mode recovers on the next file change).
      await buildContext.rebuild().then(
        () => undefined,
        () => undefined
      )

      if (options.watch) {
        await buildContext.watch()
      } else {
        await buildContext.dispose()
        buildContext = null
      }

      return {
        getBundle: () => current,
        dispose: async () => {
          if (buildContext !== null) {
            await buildContext.dispose()
            buildContext = null
          }
        }
      }
    })(),
    (cause): BundleError => ({ message: cause instanceof Error ? cause.message : 'client bundler failed to start' })
  )
}

/**
 * Serves the in-memory bundle at CLIENT_BUNDLE_PATH with ETag
 * revalidation — no-cache keeps dev instant while 304s keep it cheap.
 */
export function registerClientBundleRoute (
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  bundler: ClientBundler
): void {
  registerRoute('GET', CLIENT_BUNDLE_PATH, async (req: IncomingMessage, res: ServerResponse) => {
    const bundle = bundler.getBundle()
    if (bundle === null) {
      const body = JSON.stringify({ error: { code: 'BUNDLE_UNAVAILABLE', message: 'Client bundle has not built successfully yet — check the server log' } })
      res.writeHead(503, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
      res.end(body)
      return
    }

    if (req.headers['if-none-match'] === bundle.etag) {
      res.writeHead(304, { ETag: bundle.etag })
      res.end()
      return
    }

    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Content-Length': String(Buffer.byteLength(bundle.js)),
      'Cache-Control': 'no-cache',
      ETag: bundle.etag
    })
    res.end(bundle.js)
  })
}
