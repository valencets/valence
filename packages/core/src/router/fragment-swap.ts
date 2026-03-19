import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
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
