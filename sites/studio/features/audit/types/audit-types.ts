export interface LighthouseScore {
  readonly performance: number
  readonly accessibility: number
  readonly bestPractices: number
  readonly seo: number
}

export interface LighthouseMetric {
  readonly id: string
  readonly title: string
  readonly numericValue: number
  readonly displayValue: string
}

export interface LighthouseResult {
  readonly url: string
  readonly scores: LighthouseScore
  readonly metrics: ReadonlyArray<LighthouseMetric>
  readonly fetchedAt: string
}

export const AuditErrorCode = {
  INVALID_URL: 'INVALID_URL',
  AUDIT_IN_PROGRESS: 'AUDIT_IN_PROGRESS',
  AUDIT_TIMEOUT: 'AUDIT_TIMEOUT',
  AUDIT_FAILED: 'AUDIT_FAILED',
  RATE_LIMITED: 'RATE_LIMITED'
} as const

export type AuditErrorCode = typeof AuditErrorCode[keyof typeof AuditErrorCode]

export interface AuditError {
  readonly code: AuditErrorCode
  readonly message: string
}
