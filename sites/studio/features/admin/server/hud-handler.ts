import type { RouteHandler } from '../../../server/types.js'
import { isFragmentRequest, sendHtml } from '../../../server/router.js'
import { renderShell, renderFragment } from '../../../server/shell.js'
import { checkAuth } from './auth-middleware.js'
import { renderHudPage } from '../templates/hud-page.js'

const LOGIN_FORM = `
  <section class="section">
    <div class="container">
      <h1 class="hero-title">Admin Login</h1>
      <p>Authorization required. Provide a valid bearer token.</p>
    </div>
  </section>
`

export function createHudHandler (adminToken: string): RouteHandler {
  return (req, res, ctx) => {
    const authResult = checkAuth(req.headers.authorization, adminToken)

    if (authResult.isErr()) {
      const html = isFragmentRequest(req)
        ? renderFragment(LOGIN_FORM)
        : renderShell(LOGIN_FORM, 'Admin | Inertia Studio', '', '')
      sendHtml(res, html, 401)
      return
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const diagnostics = url.searchParams.get('diagnostics') === '1'
    const content = renderHudPage(diagnostics)

    const html = isFragmentRequest(req)
      ? renderFragment(content)
      : renderShell(content, 'Dashboard | Inertia Studio', '', '')
    sendHtml(res, html)
  }
}
