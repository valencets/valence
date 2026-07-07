import { ok } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { IntentType } from './intent-types.js'
import type { TelemetryError } from './intent-types.js'
import type { TelemetryRingBuffer } from './ring-buffer.js'

export interface EventDelegationHandle {
  destroy (): void
}

export const intentTypeMap: Readonly<Record<string, IntentType | undefined>> = Object.freeze({
  CLICK: IntentType.CLICK,
  SCROLL: IntentType.SCROLL,
  VIEWPORT_INTERSECT: IntentType.VIEWPORT_INTERSECT,
  FORM_INPUT: IntentType.FORM_INPUT,
  INTENT_NAVIGATE: IntentType.INTENT_NAVIGATE,
  INTENT_CALL: IntentType.INTENT_CALL,
  INTENT_BOOK: IntentType.INTENT_BOOK,
  INTENT_LEAD: IntentType.INTENT_LEAD,
  LEAD_PHONE: IntentType.LEAD_PHONE,
  LEAD_EMAIL: IntentType.LEAD_EMAIL,
  LEAD_FORM: IntentType.LEAD_FORM,
  PAGEVIEW: IntentType.PAGEVIEW
})

export const leadHrefMap: Readonly<Record<string, IntentType | undefined>> = Object.freeze({
  'tel:': IntentType.LEAD_PHONE,
  'mailto:': IntentType.LEAD_EMAIL
})

function detectLeadAction (el: Element): IntentType | null {
  const anchor = el.closest('a')
  if (anchor === null) return null
  const href = anchor.getAttribute('href') ?? ''
  for (const prefix in leadHrefMap) {
    const intentType = leadHrefMap[prefix]
    if (intentType !== undefined && href.startsWith(prefix)) return intentType
  }
  return null
}

export function initEventDelegation (
  buffer: TelemetryRingBuffer,
  rootElement?: HTMLElement
): Result<EventDelegationHandle, TelemetryError> {
  const root = rootElement ?? document.body

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
    if (!(event instanceof MouseEvent)) return
    const target = event.target
    if (!(target instanceof Element)) return

    // Check for lead action links (tel:, mailto:)
    const leadType = detectLeadAction(target)
    if (leadType !== null) {
      const anchor = target.closest('a')
      writeIntent(leadType, anchor?.getAttribute('href') ?? '', event)
      return
    }

    // Standard data-telemetry-type delegation
    const tracked = target.closest('[data-telemetry-type]')
    if (tracked === null) return

    const typeAttr = tracked.getAttribute('data-telemetry-type') ?? ''
    const intentType = intentTypeMap[typeAttr]
    if (intentType === undefined) return

    const targetDOMNode = tracked.getAttribute('data-telemetry-target') ?? ''
    writeIntent(intentType, targetDOMNode, event)
  }

  root.addEventListener('click', handleClick)

  const handle: EventDelegationHandle = {
    destroy () {
      root.removeEventListener('click', handleClick)
    }
  }

  return ok(handle)
}
