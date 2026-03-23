// Outlet-aware fragment swap.
// Extracts content from a named val-outlet in incoming HTML and
// swaps it into the matching live val-outlet in the DOM.

import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { parseHtml } from './fragment-swap.js'
import { findOutlet } from './val-outlet.js'
import { swapContent } from './fragment-swap.js'
import { RouterErrorCode } from './router-types.js'
import type { RouterError } from './router-types.js'

export function extractOutletFragment (html: string, name: string | undefined): Result<Element, RouterError> {
  const docResult = parseHtml(html)
  if (docResult.isErr()) return err(docResult.error)

  const doc = docResult.value

  // Try to find the named outlet in the incoming document
  const outlet = findOutlet(doc.body, name)
  if (outlet !== null) return ok(outlet)

  // If a specific name was requested and not found, that is an error
  if (name !== undefined) {
    return err({
      code: RouterErrorCode.SELECTOR_MISS,
      message: `Outlet "${name}" not found in incoming HTML`
    })
  }

  // For unnamed (default) outlet: fallback to doc.body as the fragment source
  return ok(doc.body)
}

export function swapOutletContent (
  liveRoot: Element,
  name: string | undefined,
  html: string
): Result<void, RouterError> {
  const liveOutlet = findOutlet(liveRoot, name)
  if (liveOutlet === null) {
    return err({
      code: RouterErrorCode.SELECTOR_MISS,
      message: `Outlet not found in live DOM: ${name ?? '(default)'}`
    })
  }

  const fragmentResult = extractOutletFragment(html, name)
  if (fragmentResult.isErr()) return err(fragmentResult.error)

  return swapContent(liveOutlet, fragmentResult.value)
}
