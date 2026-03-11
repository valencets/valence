export interface InspectorData {
  readonly type: string
  readonly target: string
  readonly bufferSlot: number
  readonly isDirty: boolean
  readonly flushCountdown: number
  readonly explainer: string
}

export interface StripState {
  readonly filledSlots: number
  readonly totalSlots: number
  readonly headPointer: number
  readonly flushCountdown: number
  readonly hardwareLabel: string
}
