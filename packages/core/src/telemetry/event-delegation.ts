import { ok } from 'neverthrow'
import type { Result } from 'neverthrow'
import { IntentType } from './intent-types.js'
import type { TelemetryError } from './intent-types.js'
import type { TelemetryRingBuffer } from './ring-buffer.js'

export interface EventDelegationHandle {
  destroy (): void
}

const intentTypeMap: Record<string, IntentType | undefined> = {
  CLICK: IntentType.CLICK,
  SCROLL: IntentType.SCROLL,
  VIEWPORT_INTERSECT: IntentType.VIEWPORT_INTERSECT,
  FORM_INPUT: IntentType.FORM_INPUT,
  INTENT_NAVIGATE: IntentType.INTENT_NAVIGATE,
  INTENT_CALL: IntentType.INTENT_CALL,
  INTENT_BOOK: IntentType.INTENT_BOOK,
  LEAD_PHONE: IntentType.LEAD_PHONE,
  LEAD_EMAIL: IntentType.LEAD_EMAIL,
  LEAD_FORM: IntentType.LEAD_FORM
}

export function initEventDelegation (
  buffer: TelemetryRingBuffer,
  rootElement?: HTMLElement
): Result<EventDelegationHandle, TelemetryError> {
  const root = rootElement ?? document.body

  // Detect lead action links by href prefix
  const leadHrefMap: Record<string, IntentType> = {
    'tel:': IntentType.LEAD_PHONE,
    'mailto:': IntentType.LEAD_EMAIL
  }

  function detectLeadAction (el: Element): IntentType | null {
    const anchor = el.closest('a')
    if (anchor === null) return null
    const href = anchor.getAttribute('href') ?? ''
    for (const prefix in leadHrefMap) {
      if (href.startsWith(prefix)) return leadHrefMap[prefix]!
    }
    return null
  }

  function writeIntent (intentType: IntentType, targetDOMNode: string, mouseEvent: MouseEvent): void {
    const writeResult = buffer.write(
      intentType,
      targetDOMNode,
      mouseEvent.clientX,
      mouseEvent.clientY,
      Date.now()
    )
    if (writeResult.isOk()) {
      writeResult.value.path = window.location.pathname
      writeResult.value.referrer = document.referrer
    }
  }

  function handleClick (event: Event): void {
    const mouseEvent = event as MouseEvent
    const target = mouseEvent.target as Element | null
    if (target === null) return

    // Check for lead action links (tel:, mailto:)
    const leadType = detectLeadAction(target)
    if (leadType !== null) {
      const anchor = target.closest('a')
      writeIntent(leadType, anchor?.getAttribute('href') ?? '', mouseEvent)
      return
    }

    // Standard data-telemetry-type delegation
    const tracked = target.closest('[data-telemetry-type]')
    if (tracked === null) return

    const typeAttr = tracked.getAttribute('data-telemetry-type') ?? ''
    const intentType = intentTypeMap[typeAttr]
    if (intentType === undefined) return

    const targetDOMNode = tracked.getAttribute('data-telemetry-target') ?? ''
    writeIntent(intentType, targetDOMNode, mouseEvent)
  }

  root.addEventListener('click', handleClick)

  const handle: EventDelegationHandle = {
    destroy () {
      root.removeEventListener('click', handleClick)
    }
  }

  return ok(handle)
}
