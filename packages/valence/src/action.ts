import { ResultAsync } from '@valencets/resultkit'
import type { ActionContext, ActionResult } from './define-config.js'

export interface ActionError {
  readonly code: 'ACTION_FAILED'
  readonly message: string
}

export function executeAction (
  action: (ctx: ActionContext) => Promise<ActionResult>,
  ctx: ActionContext
): ResultAsync<ActionResult, ActionError> {
  return ResultAsync.fromPromise(
    action(ctx),
    (reason): ActionError => {
      const message = reason instanceof Error
        ? reason.message
        : 'Action execution failed'
      return { code: 'ACTION_FAILED', message }
    }
  )
}

export function readRequestBody (req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => { resolve(Buffer.concat(chunks).toString('utf-8')) })
    req.on('error', reject)
  })
}
