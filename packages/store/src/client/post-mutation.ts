import { ResultAsync, fromThrowable } from '@valencets/resultkit'
import type { StoreState, StoreValue } from '../types.js'
import { StoreErrorCode } from '../types.js'

export interface PostMutationResponse {
  readonly ok: boolean
  readonly state?: StoreState
  readonly confirmedId?: number
  readonly fragment?: { readonly selector: string; readonly html: string }
  readonly error?: { readonly code: string; readonly message: string }
}

export type PostMutationFn = (
  storeSlug: string,
  mutationName: string,
  args: { [key: string]: StoreValue },
  mutationId: number
) => Promise<PostMutationResponse>

const SAFE_PATH_SEGMENT = /^[a-zA-Z][a-zA-Z0-9_-]*$/

const failure = (message: string): PostMutationResponse => ({
  ok: false,
  error: { code: StoreErrorCode.MUTATION_FAILED, message }
})

const safeParseResponse = fromThrowable(
  (text: string) => JSON.parse(text) as PostMutationResponse,
  () => null
)

/**
 * Production transport: POST /store/<slug>/<mutation> with { args, mutationId }.
 * Session identity travels via same-origin cookies. Network and parse failures
 * surface as failed responses, never as thrown errors.
 */
export function createPostMutation (): PostMutationFn {
  return async (storeSlug, mutationName, args, mutationId) => {
    if (!SAFE_PATH_SEGMENT.test(storeSlug) || !SAFE_PATH_SEGMENT.test(mutationName)) {
      return failure(`Invalid store or mutation name: '${storeSlug}/${mutationName}'`)
    }

    const responseResult = await ResultAsync.fromPromise(
      fetch(`/store/${storeSlug}/${mutationName}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args, mutationId })
      }),
      (cause) => (cause instanceof Error ? cause.message : 'network failure')
    )
    if (responseResult.isErr()) {
      return failure(responseResult.error)
    }

    const textResult = await ResultAsync.fromPromise(
      responseResult.value.text(),
      () => 'unreadable response body'
    )
    if (textResult.isErr()) {
      return failure(textResult.error)
    }

    const parsed = safeParseResponse(textResult.value)
    if (parsed.isErr() || parsed.value === null || typeof parsed.value !== 'object') {
      return failure('malformed server response')
    }

    if (!responseResult.value.ok) {
      return {
        ok: false,
        error: parsed.value.error ?? { code: StoreErrorCode.MUTATION_FAILED, message: `HTTP ${responseResult.value.status}` }
      }
    }

    return parsed.value
  }
}
