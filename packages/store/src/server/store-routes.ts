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
    args: { [key: string]: string | number | boolean | null },
    clientMutationId?: number
  ) => Promise<Result<MutationResult, StoreError>>
  readonly getState: (sessionId: string) => StoreState
}

const defaultPool = { query: async () => [] }

const GLOBAL_STATE_KEY = '__global__'

// The scope decides which bucket of the state holder a request touches:
// global stores share ONE copy across all sessions, everything else is
// keyed per session.
function stateKeyFor (config: StoreDefinition, sessionId: string): string {
  return config.scope === 'global' ? GLOBAL_STATE_KEY : sessionId
}

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
      args: { [key: string]: string | number | boolean | null },
      clientMutationId?: number
    ): Promise<Result<MutationResult, StoreError>> {
      const session: SessionInfo = { id: sessionId }
      const stateKey = stateKeyFor(config, sessionId)
      const result = await handleMutation(config, stateHolder, stateKey, mutationName, args, defaultPool, session, clientMutationId)

      if (result.isOk() && broadcaster) {
        // Scope decides the SSE audience: global fans out to every session,
        // session/user reach only the mutating session's tabs, page is
        // client-local and never broadcasts.
        if (config.scope === 'global') {
          broadcaster.broadcast(slug, 'state', result.value.state)
        } else if (config.scope !== 'page') {
          broadcaster.sendToSession(slug, sessionId, 'state', result.value.state)
        }
      }

      return result
    },

    getState (sessionId: string): StoreState {
      return stateHolder.getState(stateKeyFor(config, sessionId))
    }
  }
}
