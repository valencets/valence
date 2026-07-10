import type { Result } from '@valencets/resultkit'
import type { StoreDefinition, StoreState, StoreError, SessionInfo, MutationPool } from '../types.js'
import type { StateBackend } from './state-backend.js'
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
    session: SessionInfo,
    mutationName: string,
    args: { [key: string]: string | number | boolean | null },
    clientMutationId?: number
  ) => Promise<Result<MutationResult, StoreError>>
  readonly getState: (session: SessionInfo) => StoreState | Promise<StoreState>
}

/**
 * Parameterized query contract for store persistence and mutation server
 * fns — `query(text, params?)`, values always bound as `$n` parameters.
 * Pools that can open transactions expose `transaction`, which runs the
 * callback on ONE connection inside BEGIN/COMMIT — required for the
 * row-locked persisted-bucket path (#336). Pools without it fall back to
 * the in-process mutation lock only (single-node semantics).
 */
export interface StorePool extends MutationPool {
  readonly transaction?: <T>(fn: (tx: MutationPool) => Promise<T>) => Promise<T>
}

const defaultPool: StorePool = { query: async () => [] }

const GLOBAL_STATE_KEY = '__global__'

// The scope decides which bucket of the state backend a request touches:
// global stores share ONE copy, user stores follow the verified userId
// across sessions and devices, everything else is keyed per session.
function stateKeyFor (config: StoreDefinition, session: SessionInfo): string {
  if (config.scope === 'global') return GLOBAL_STATE_KEY
  if (config.scope === 'user' && session.userId !== undefined) return `user:${session.userId}`
  return session.id
}

export function registerStoreRoutes (
  config: StoreDefinition,
  stateHolder: StateBackend,
  broadcaster?: SSEBroadcaster,
  pool?: StorePool
): StoreRouteHandlers {
  const slug = config.slug
  const mutationPool = pool ?? defaultPool

  return {
    mutationPath: `/store/${slug}/:mutation`,
    statePath: `/store/${slug}/state`,

    async handleMutation (
      session: SessionInfo,
      mutationName: string,
      args: { [key: string]: string | number | boolean | null },
      clientMutationId?: number
    ): Promise<Result<MutationResult, StoreError>> {
      const stateKey = stateKeyFor(config, session)
      const result = await handleMutation(config, stateHolder, stateKey, mutationName, args, mutationPool, session, clientMutationId)

      if (result.isOk() && broadcaster) {
        // Scope decides the SSE audience: global fans out to every session,
        // user reaches every session of the mutating user, session reaches
        // only the mutating session's tabs, page never broadcasts.
        if (config.scope === 'global') {
          broadcaster.broadcast(slug, 'state', result.value.state)
        } else if (config.scope === 'user' && session.userId !== undefined) {
          broadcaster.sendToUser(slug, session.userId, 'state', result.value.state)
        } else if (config.scope !== 'page') {
          broadcaster.sendToSession(slug, session.id, 'state', result.value.state)
        }
      }

      return result
    },

    getState (session: SessionInfo): StoreState | Promise<StoreState> {
      return stateHolder.getState(stateKeyFor(config, session))
    }
  }
}
