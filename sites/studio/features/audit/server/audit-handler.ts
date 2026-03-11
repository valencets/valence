import { parse as parseQs } from 'node:querystring'
import { execFile } from 'node:child_process'
import { safeJsonParse } from '@inertia/ingestion'
import type { RouteHandler } from '../../../server/types.js'
import { isFragmentRequest, sendHtml, readBody } from '../../../server/router.js'
import { renderShell, renderFragment } from '../../../server/shell.js'
import { renderAuditForm } from '../templates/audit.js'
import { renderAuditResults } from '../templates/audit-results.js'
import { validateAuditUrl } from '../schemas/audit-schema.js'
import { AuditErrorCode } from '../types/audit-types.js'
import type { AuditError, LighthouseResult, LighthouseScore, LighthouseMetric } from '../types/audit-types.js'

const shellOptions = {
  title: 'Audit',
  description: 'Free Lighthouse website audit powered by Inertia.',
  criticalCSS: '',
  deferredCSSPath: '/css/studio.css',
  currentPath: '/audit'
}

// Single-audit semaphore
let auditInProgress = false

// IP-based rate limiting (1 per 5 min)
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 5 * 60 * 1000

function getClientIp (req: import('node:http').IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }
  return req.socket.remoteAddress ?? 'unknown'
}

function checkRateLimit (ip: string): AuditError | null {
  const lastAudit = rateLimitMap.get(ip)
  if (lastAudit && Date.now() - lastAudit < RATE_LIMIT_MS) {
    const remaining = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastAudit)) / 1000)
    return {
      code: AuditErrorCode.RATE_LIMITED,
      message: `Rate limited. Please wait ${remaining} seconds before running another audit.`
    }
  }
  return null
}

export const auditGetHandler: RouteHandler = async (req, res) => {
  const mainContent = renderAuditForm()

  if (isFragmentRequest(req)) {
    sendHtml(res, renderFragment(mainContent))
    return
  }

  sendHtml(res, renderShell({ ...shellOptions, mainContent }))
}

export const auditPostHandler: RouteHandler = async (req, res) => {
  const raw = await readBody(req)
  const parsed = parseQs(raw)
  const urlInput = String(parsed['url'] ?? '')

  // Validate URL
  const validation = validateAuditUrl(urlInput)
  if (validation.isErr()) {
    const mainContent = renderAuditForm(validation.error, urlInput)
    if (isFragmentRequest(req)) {
      sendHtml(res, renderFragment(mainContent), 422)
      return
    }
    sendHtml(res, renderShell({ ...shellOptions, mainContent }), 422)
    return
  }

  const url = validation.value

  // Rate limit check
  const ip = getClientIp(req)
  const rateLimitError = checkRateLimit(ip)
  if (rateLimitError) {
    const mainContent = renderAuditForm(rateLimitError, url)
    if (isFragmentRequest(req)) {
      sendHtml(res, renderFragment(mainContent), 429)
      return
    }
    sendHtml(res, renderShell({ ...shellOptions, mainContent }), 429)
    return
  }

  // Semaphore check
  if (auditInProgress) {
    const error: AuditError = {
      code: AuditErrorCode.AUDIT_IN_PROGRESS,
      message: 'An audit is already in progress. Please try again in a minute.'
    }
    const mainContent = renderAuditForm(error, url)
    if (isFragmentRequest(req)) {
      sendHtml(res, renderFragment(mainContent), 503)
      return
    }
    sendHtml(res, renderShell({ ...shellOptions, mainContent }), 503)
    return
  }

  // Run Lighthouse
  auditInProgress = true
  rateLimitMap.set(ip, Date.now())

  const lighthouseResult = await runLighthouse(url)

  auditInProgress = false

  if (!lighthouseResult) {
    const error: AuditError = {
      code: AuditErrorCode.AUDIT_FAILED,
      message: 'Lighthouse audit failed or timed out. The target site may be unreachable.'
    }
    const mainContent = renderAuditForm(error, url)
    if (isFragmentRequest(req)) {
      sendHtml(res, renderFragment(mainContent), 500)
      return
    }
    sendHtml(res, renderShell({ ...shellOptions, mainContent }), 500)
    return
  }

  const mainContent = renderAuditResults(lighthouseResult)
  if (isFragmentRequest(req)) {
    sendHtml(res, renderFragment(mainContent))
    return
  }
  sendHtml(res, renderShell({ ...shellOptions, title: `Audit: ${url}`, mainContent }))
}

function runLighthouse (url: string): Promise<LighthouseResult | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(null)
    }, 60000)

    execFile(
      'lighthouse',
      [url, '--output=json', '--chrome-flags=--headless --no-sandbox', '--quiet'],
      { timeout: 60000, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => {
        clearTimeout(timeout)
        if (error) {
          console.error('Lighthouse error:', error.message)
          resolve(null)
          return
        }

        const parsed = parseLighthouseOutput(stdout)
        resolve(parsed)
      }
    )
  })
}

function parseLighthouseOutput (stdout: string): LighthouseResult | null {
  const idx = stdout.indexOf('{')
  if (idx === -1) return null
  const jsonStr = stdout.slice(idx)

  // safeJsonParse is the one permitted JSON.parse boundary
  const parseResult = safeJsonParse(jsonStr)
  if (parseResult.isErr()) return null

  const data = parseResult.value as Record<string, unknown>

  const categories = data['categories'] as Record<string, { score: number }> | undefined
  if (!categories) return null

  const scores: LighthouseScore = {
    performance: Math.round((categories['performance']?.score ?? 0) * 100),
    accessibility: Math.round((categories['accessibility']?.score ?? 0) * 100),
    bestPractices: Math.round((categories['best-practices']?.score ?? 0) * 100),
    seo: Math.round((categories['seo']?.score ?? 0) * 100)
  }

  const audits = data['audits'] as Record<string, { id?: string; title?: string; numericValue?: number; displayValue?: string }> | undefined

  const metricKeys = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'total-blocking-time',
    'cumulative-layout-shift',
    'speed-index',
    'interactive'
  ]

  const metrics: LighthouseMetric[] = metricKeys
    .map((key) => {
      const audit = audits?.[key]
      if (!audit) return null
      return {
        id: key,
        title: audit.title ?? key,
        numericValue: audit.numericValue ?? 0,
        displayValue: audit.displayValue ?? '—'
      }
    })
    .filter((m): m is LighthouseMetric => m !== null)

  return {
    url: String((data['requestedUrl'] ?? data['finalUrl']) ?? ''),
    scores,
    metrics,
    fetchedAt: new Date().toISOString()
  }
}
