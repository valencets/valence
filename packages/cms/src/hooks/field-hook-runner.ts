import { okAsync } from '@valencets/resultkit'
import type { ResultAsync } from '@valencets/resultkit'
import type { CmsError } from '../schema/types.js'
import type { HookData } from './hook-types.js'
import type { FieldConfig } from '../schema/field-types.js'
import { runHooks } from './hook-runner.js'
import { flattenFields } from '../schema/field-utils.js'

export function runFieldHooks (
  hookName: 'beforeValidate' | 'beforeChange' | 'afterChange' | 'afterRead',
  fields: readonly FieldConfig[],
  data: HookData,
  id?: string,
  collection?: string
): ResultAsync<HookData, CmsError> {
  let result = okAsync<HookData, CmsError>(data)

  for (const f of flattenFields(fields)) {
    const hooks = f.hooks?.[hookName]
    if (!hooks || hooks.length === 0) continue
    result = result.andThen((currentData) =>
      runHooks(hooks, { data: currentData, id, collection })
    )
  }

  return result
}
