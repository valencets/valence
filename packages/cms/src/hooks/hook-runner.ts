import { ResultAsync } from '@valencets/resultkit'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { HookFunction, HookArgs, HookData } from './hook-types.js'

export function runHooks (
  hooks: readonly HookFunction[],
  args: HookArgs
): ResultAsync<HookData, CmsError> {
  return ResultAsync.fromPromise(
    (async (): Promise<HookData> => {
      let currentData: HookData = args.data
      for (const hook of hooks) {
        const result = await hook({ ...args, data: currentData })
        if (result !== undefined) {
          currentData = result
        }
      }
      return currentData
    })(),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INTERNAL,
      message: e instanceof Error ? e.message : 'Hook execution failed'
    })
  )
}
