import { ok, err, ResultAsync } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { generateStoreSchema } from '../validation/zod-generator.js'
import type { StoreDefinition, StoreState, StoreError, SessionInfo } from '../types.js'
import { StoreErrorCode } from '../types.js'
import type { SessionStateHolder } from './session-state.js'

interface MutationResult {
  readonly state: StoreState
  readonly confirmedId: number
}

let _nextMutationId = 1

export async function handleMutation (
  config: StoreDefinition,
  stateHolder: SessionStateHolder,
  sessionId: string,
  mutationName: string,
  args: { [key: string]: string | number | boolean | null },
  pool: { readonly query: (...args: readonly string[]) => Promise<readonly unknown[]> },
  session: SessionInfo
): Promise<Result<MutationResult, StoreError>> {
  const mutation = config.mutations[mutationName]
  if (mutation === undefined) {
    return err({
      code: StoreErrorCode.INVALID_MUTATION,
      message: `Unknown mutation: '${mutationName}'`
    })
  }

  if (mutation.input.length > 0) {
    const inputSchema = generateStoreSchema(mutation.input)
    const validation = inputSchema.safeParse(args)
    if (!validation.success) {
      return err({
        code: StoreErrorCode.VALIDATION_FAILED,
        message: `Mutation '${mutationName}' input validation failed: ${validation.error.message}`
      })
    }
  }

  const state = stateHolder.getState(sessionId)
  const mutationId = _nextMutationId++

  const result = await ResultAsync.fromPromise(
    mutation.server({ state, input: args, pool, session }),
    (e) => ({
      code: StoreErrorCode.MUTATION_FAILED,
      message: e instanceof Error ? e.message : `Mutation '${mutationName}' failed`
    })
  )

  if (result.isErr()) {
    return err(result.error)
  }

  stateHolder.setState(sessionId, state)

  return ok({
    state: stateHolder.getState(sessionId),
    confirmedId: mutationId
  })
}
