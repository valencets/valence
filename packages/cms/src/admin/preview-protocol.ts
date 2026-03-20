export const PREVIEW_MESSAGE_TYPE = 'valence:preview-update' as const

interface PreviewMessageData {
  readonly type: typeof PREVIEW_MESSAGE_TYPE
  readonly data: Record<string, string>
}

function isPlainObject (value: unknown): value is Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isPreviewMessageData (value: unknown): value is PreviewMessageData {
  if (!isPlainObject(value)) return false
  const obj = value as Record<string, unknown>
  return obj['type'] === PREVIEW_MESSAGE_TYPE && isPlainObject(obj['data'])
}

export function isPreviewMessage (event: MessageEvent): boolean {
  return isPreviewMessageData(event.data)
}

export function parsePreviewData (event: MessageEvent): Record<string, string> | null {
  if (!isPreviewMessageData(event.data)) return null
  return event.data.data
}
