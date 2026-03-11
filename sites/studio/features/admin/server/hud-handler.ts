import type { RouteHandler } from '../../../server/types.js'
import { isFragmentRequest, sendHtml, readBody } from '../../../server/router.js'
import { renderShell, renderFragment } from '../../../server/shell.js'
import { checkAuth } from './auth-middleware.js'
import { renderHudPage } from '../templates/hud-page.js'
import { renderLoginForm } from '../templates/login-form.js'

const SHELL_BASE = {
  description: 'Admin dashboard',
  criticalCSS: '',
  deferredCSSPath: '/css/studio.css',
  currentPath: '/admin/hud'
}

function showLogin (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, error?: string): void {
  const content = renderLoginForm(error)
  const html = isFragmentRequest(req)
    ? renderFragment(content)
    : renderShell({ ...SHELL_BASE, title: 'Admin Login', mainContent: content })
  sendHtml(res, html, 401)
}

function extractTokenFromCookie (cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined
  const match = /admin_token=([^;]+)/.exec(cookieHeader)
  return match?.[1]
}

export function createHudHandler (adminToken: string): RouteHandler {
  return async (req, res) => {
    // Check Authorization header first, then cookie
    let authResult = checkAuth(req.headers.authorization, adminToken)

    if (authResult.isErr()) {
      const cookieToken = extractTokenFromCookie(req.headers.cookie)
      if (cookieToken) {
        authResult = checkAuth(`Bearer ${cookieToken}`, adminToken)
      }
    }

    if (authResult.isErr()) {
      showLogin(req, res)
      return
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const diagnostics = url.searchParams.get('diagnostics') === '1'
    const content = renderHudPage(diagnostics)

    const html = isFragmentRequest(req)
      ? renderFragment(content)
      : renderShell({ ...SHELL_BASE, title: 'Dashboard', mainContent: content })
    sendHtml(res, html)
  }
}

export function createHudPostHandler (adminToken: string): RouteHandler {
  return async (req, res) => {
    const body = await readBody(req)
    const { parse: parseQs } = await import('node:querystring')
    const parsed = parseQs(body)
    const token = String(parsed['token'] ?? '')

    const authResult = checkAuth(`Bearer ${token}`, adminToken)

    if (authResult.isErr()) {
      showLogin(req, res, 'Invalid token. Please try again.')
      return
    }

    // Set auth cookie and redirect
    res.writeHead(302, {
      'Set-Cookie': `admin_token=${token}; HttpOnly; SameSite=Strict; Path=/admin`,
      Location: '/admin/hud'
    })
    res.end()
  }
}
