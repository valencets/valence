import type { ValidatedIntent } from './schemas.js'

export interface InsertableEvent {
  readonly session_id: string
  readonly event_category: string
  readonly dom_target: string | null
  readonly payload: Record<string, unknown>
}

// Intent type → event category mapping (static dictionary, no switch)
const INTENT_CATEGORY_MAP: Record<string, string> = {
  CLICK: 'CLICK',
  SCROLL: 'SCROLL',
  VIEWPORT_INTERSECT: 'VIEWPORT_INTERSECT',
  FORM_INPUT: 'FORM_INPUT',
  INTENT_NAVIGATE: 'INTENT_NAVIGATE',
  INTENT_CALL: 'INTENT_CALL',
  INTENT_BOOK: 'INTENT_BOOK'
}

export function transformIntentToEvent (
  intent: ValidatedIntent,
  sessionId: string
): InsertableEvent {
  return {
    session_id: sessionId,
    event_category: INTENT_CATEGORY_MAP[intent.type] ?? intent.type,
    dom_target: intent.targetDOMNode || null,
    payload: {
      id: intent.id,
      timestamp: intent.timestamp,
      x_coord: intent.x_coord,
      y_coord: intent.y_coord
    }
  }
}

export function transformIntentsToEvents (
  intents: ReadonlyArray<ValidatedIntent>,
  sessionId: string
): ReadonlyArray<InsertableEvent> {
  return intents.map((intent) => transformIntentToEvent(intent, sessionId))
}
