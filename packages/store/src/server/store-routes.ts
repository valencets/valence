import type { Result } from '@valencets/resultkit'
import type { StoreDefinition, StoreState, StoreError, SessionInfo } from '../types.js'
import type { SessionStateHolder } from './session-state.js'
import type { SSEBroadcaster } from './sse-broadcaster.js'
import { handleMutation } from './mutation-handler.js'

interface MutationResult {
  readonly state: StoreState
  readonly confirmedId: number
}

interface StoreRouteHandlers {
  readonly mutationPath: string
  readonly statePath: string
  readonly handleMutation: (
    sessionId: string,
    mutationName: string,
    args: { [key: string]: string | number | boolean | null }
  ) => Promise<Result<MutationResult, StoreError>>
  readonly getState: (sessionId: string) => StoreState
}

const defaultPool = { query: async () => [] }

export function registerStoreRoutes (
  config: StoreDefinition,
  stateHolder: SessionStateHolder,
  broadcaster?: SSEBroadcaster
): StoreRouteHandlers {
  const slug = config.slug

  return {
    mutationPath: `/store/${slug}/:mutation`,
    statePath: `/store/${slug}/state`,

    async handleMutation (
      sessionId: string,
      mutationName: string,
      args: { [key: string]: string | number | boolean | null }
    ): Promise<Result<MutationResult, StoreError>> {
      const session: SessionInfo = { id: sessionId }
      const result = await handleMutation(config, stateHolder, sessionId, mutationName, args, defaultPool, session)

      if (result.isOk() && broadcaster) {
        broadcaster.broadcastExcept(slug, sessionId, 'state', result.value.state)
      }

      return result
    },

    getState (sessionId: string): StoreState {
      return stateHolder.getState(sessionId)
    }
  }
}
