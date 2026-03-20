// Server-side outlet header utilities.
// Routes tell the client which val-outlet to target when responding to
// fragment navigation requests via X-Valence-Outlet response header.

import type { IncomingMessage, ServerResponse } from 'node:http'

export function setOutletHeader (res: ServerResponse, outletName: string | undefined): void {
  if (outletName === undefined) return
  res.setHeader('X-Valence-Outlet', outletName)
}

export function isFragmentRequest (req: IncomingMessage): boolean {
  return req.headers['x-valence-fragment'] === '1'
}
