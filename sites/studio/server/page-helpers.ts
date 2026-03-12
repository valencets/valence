import type { IncomingMessage, ServerResponse } from 'node:http'
import { isFragmentRequest, sendHtml } from './router.js'
import { renderShell, renderFragment } from './shell.js'
import type { RouteContext } from './types.js'

export interface PageOptions {
  readonly title: string
  readonly description: string
  readonly deferredCSSPath: string
  readonly mainContent: string
  readonly currentPath: string
}

export function respondWithPage (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext,
  options: PageOptions,
  statusCode?: number
): void {
  if (isFragmentRequest(req)) {
    sendHtml(res, renderFragment(options.mainContent), statusCode)
    return
  }

  const criticalCSS = ctx.cssPipeline.getCriticalCSS(options.currentPath) ?? ''
  const html = renderShell({
    title: options.title,
    description: options.description,
    criticalCSS,
    deferredCSSPath: options.deferredCSSPath,
    mainContent: options.mainContent,
    currentPath: options.currentPath
  })
  sendHtml(res, html, statusCode)
}
