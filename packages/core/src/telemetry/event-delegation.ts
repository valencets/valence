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
  INTENT_BOOK: IntentType.INTENT_BOOK
}

export function initEventDelegation (
  buffer: TelemetryRingBuffer,
  rootElement?: HTMLElement
): Result<EventDelegationHandle, TelemetryError> {
  const root = rootElement ?? document.body

  function handleClick (event: Event): void {
    const mouseEvent = event as MouseEvent
    const target = mouseEvent.target as Element | null
    if (target === null) return

    const tracked = target.closest('[data-telemetry-type]')
    if (tracked === null) return

    const typeAttr = tracked.getAttribute('data-telemetry-type') ?? ''
    const intentType = intentTypeMap[typeAttr]
    if (intentType === undefined) return

    const targetDOMNode = tracked.getAttribute('data-telemetry-target') ?? ''

    buffer.write(
      intentType,
      targetDOMNode,
      mouseEvent.clientX,
      mouseEvent.clientY,
      Date.now()
    )
  }

  root.addEventListener('click', handleClick)

  const handle: EventDelegationHandle = {
    destroy () {
      root.removeEventListener('click', handleClick)
    }
  }

  return ok(handle)
}
