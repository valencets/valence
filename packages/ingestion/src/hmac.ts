import { createHmac, timingSafeEqual } from 'node:crypto'
import { ok, err } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'

export const HmacErrorCode = {
  INVALID_SIGNATURE: 'INVALID_SIGNATURE',
  MISSING_SIGNATURE: 'MISSING_SIGNATURE'
} as const

export type HmacErrorCode = typeof HmacErrorCode[keyof typeof HmacErrorCode]

export interface HmacError {
  readonly code: HmacErrorCode
  readonly message: string
}

export function signPayload (secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function verifySignature (secret: string, body: string, signature: string): Result<true, HmacError> {
  if (signature.length === 0) {
    return err({
      code: HmacErrorCode.MISSING_SIGNATURE,
      message: 'Signature is empty'
    })
  }

  const expected = signPayload(secret, body)

  if (signature.length !== expected.length) {
    return err({
      code: HmacErrorCode.INVALID_SIGNATURE,
      message: 'Signature length mismatch'
    })
  }

  const sigBuffer = Buffer.from(signature, 'hex')
  const expectedBuffer = Buffer.from(expected, 'hex')

  if (sigBuffer.length !== expectedBuffer.length) {
    return err({
      code: HmacErrorCode.INVALID_SIGNATURE,
      message: 'Invalid signature'
    })
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    return err({
      code: HmacErrorCode.INVALID_SIGNATURE,
      message: 'Invalid signature'
    })
  }

  return ok(true)
}
