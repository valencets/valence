export const CmsErrorCode = Object.freeze({
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  DUPLICATE_SLUG: 'DUPLICATE_SLUG',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL: 'INTERNAL'
} as const)

export type CmsErrorCode = typeof CmsErrorCode[keyof typeof CmsErrorCode]

export interface CmsError {
  readonly code: CmsErrorCode
  readonly message: string
}
