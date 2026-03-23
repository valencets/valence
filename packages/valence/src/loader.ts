import { ResultAsync } from '@valencets/resultkit'
import type { LoaderContext, LoaderResult, JsonValue } from './define-config.js'

export interface LoaderError {
  readonly code: 'LOADER_FAILED'
  readonly message: string
}

export function executeLoader (
  loader: (ctx: LoaderContext) => Promise<LoaderResult>,
  ctx: LoaderContext
): ResultAsync<LoaderResult, LoaderError> {
  return ResultAsync.fromPromise(
    loader(ctx),
    (reason): LoaderError => {
      const message = reason instanceof Error
        ? reason.message
        : 'Loader execution failed'
      return { code: 'LOADER_FAILED', message }
    }
  )
}

// Escape </script> to prevent XSS in inline JSON
function escapeScript (json: string): string {
  return json.replace(/<\/script>/gi, '<\\/script>')
}

export function serializeLoaderData (data: Record<string, JsonValue> | undefined): string {
  const payload = data !== undefined ? data : {}
  const json = escapeScript(JSON.stringify(payload))
  return `<script type="application/json" data-val-loader>${json}</script>`
}

export function injectLoaderData (html: string, script: string): string {
  const closeBody = html.indexOf('</body>')
  if (closeBody !== -1) {
    return html.slice(0, closeBody) + script + html.slice(closeBody)
  }
  return html + script
}
