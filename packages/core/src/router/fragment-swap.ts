import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { RouterErrorCode } from './router-types.js'
import type { RouterError } from './router-types.js'

function hasMoveBefore (target: Element): target is Element & { moveBefore (node: Node, ref: Node | null): void } {
  return typeof (target as { moveBefore?: Function }).moveBefore === 'function'
}

export const supportsMoveBefore: boolean =
  typeof Element !== 'undefined' &&
  hasMoveBefore(Element.prototype)

const parser = new DOMParser()

export function parseHtml (html: string): Result<Document, RouterError> {
  if (html === '') {
    return err({
      code: RouterErrorCode.PARSE_FAILED,
      message: 'Empty HTML string'
    })
  }

  const doc = parser.parseFromString(html, 'text/html')
  return ok(doc)
}

export function extractFragment (doc: Document, selector: string): Result<Element, RouterError> {
  const element = doc.querySelector(selector)
  if (element === null) {
    return err({
      code: RouterErrorCode.SELECTOR_MISS,
      message: `No element matches selector: ${selector}`
    })
  }
  return ok(element)
}

export function extractTitle (doc: Document): string | null {
  const titleEl = doc.querySelector('title')
  if (titleEl === null) return null
  return titleEl.textContent ?? null
}

export function swapContent (liveContainer: Element, newFragment: Element): Result<void, RouterError> {
  const hasMoveBeforeMethod = hasMoveBefore(liveContainer)

  if (hasMoveBeforeMethod) {
    const newChildren = Array.from(newFragment.childNodes)

    // Collect live persistent elements before clearing
    const livePersistedById = new Map<string, Element>()
    for (const el of liveContainer.querySelectorAll('[data-valence-persist][id], [transition\\:persist][id]')) {
      livePersistedById.set(el.id, el)
    }

    liveContainer.replaceChildren()

    const moveFn = liveContainer.moveBefore.bind(liveContainer)

    for (const child of newChildren) {
      const el = child as Element
      const isPersist = el.nodeType === Node.ELEMENT_NODE &&
        el.hasAttribute !== undefined &&
        (el.hasAttribute('data-valence-persist') || el.hasAttribute('transition:persist')) &&
        el.id !== ''

      if (isPersist) {
        const liveMatch = livePersistedById.get(el.id)
        if (liveMatch !== undefined) {
          moveFn(liveMatch, null)
          continue
        }
      }
      liveContainer.appendChild(child)
    }
  } else {
    liveContainer.replaceChildren(...newFragment.childNodes)
  }

  return ok(undefined)
}

export function validateFragmentResponse (response: Response): Result<void, RouterError> {
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!contentType.includes('text/html')) {
    return err({
      code: RouterErrorCode.NOT_HTML_RESPONSE,
      message: `Expected text/html but got ${contentType}`
    })
  }

  const fragmentHeader = response.headers.get('X-Valence-Fragment')
  if (fragmentHeader !== '1') {
    return err({
      code: RouterErrorCode.PARSE_FAILED,
      message: 'Missing X-Valence-Fragment header'
    })
  }

  return ok(undefined)
}

export function stripScripts (doc: Document, nonce?: string): void {
  const scripts = doc.querySelectorAll('script')
  for (const script of scripts) {
    if (nonce !== undefined && script.getAttribute('nonce') === nonce) {
      continue
    }
    script.remove()
  }
}

export function getCsrfToken (): string | undefined {
  const cookies = document.cookie.split(';')
  for (const raw of cookies) {
    const trimmed = raw.trim()
    if (trimmed.startsWith('__val_csrf=')) {
      return trimmed.slice('__val_csrf='.length)
    }
  }
  return undefined
}
