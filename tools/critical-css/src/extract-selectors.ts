import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import { CriticalCSSErrorCode } from './types.js'
import type { CriticalCSSError, ExtractedSelectors } from './types.js'

// Pre-compiled regex patterns — module-level constants
const CLASS_ATTR_RE = /class=["']([^"']*)["']/gi
const ID_ATTR_RE = /id=["']([^"']*)["']/gi
const ELEMENT_TAG_RE = /<([a-zA-Z][\w-]*)/g

export function extractSelectors (html: string): Result<ExtractedSelectors, CriticalCSSError> {
  if (html.trim().length === 0) {
    return err({
      code: CriticalCSSErrorCode.EMPTY_HTML,
      message: 'HTML input is empty'
    })
  }

  const classNames = new Set<string>()
  const ids = new Set<string>()
  const elements = new Set<string>()

  // Extract class attribute values
  let match = CLASS_ATTR_RE.exec(html)
  while (match !== null) {
    const value = match[1]
    if (value !== undefined) {
      const names = value.split(/\s+/).filter((n) => n.length > 0)
      for (const name of names) {
        classNames.add(name)
      }
    }
    match = CLASS_ATTR_RE.exec(html)
  }

  // Extract id attribute values
  match = ID_ATTR_RE.exec(html)
  while (match !== null) {
    const value = match[1]
    if (value !== undefined) {
      ids.add(value)
    }
    match = ID_ATTR_RE.exec(html)
  }

  // Extract element tag names
  match = ELEMENT_TAG_RE.exec(html)
  while (match !== null) {
    const tag = match[1]
    if (tag !== undefined) {
      elements.add(tag.toLowerCase())
    }
    match = ELEMENT_TAG_RE.exec(html)
  }

  return ok({ classNames, ids, elements })
}
