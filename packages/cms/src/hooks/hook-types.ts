export interface HookData {
  readonly [key: string]: string | number | boolean | null | readonly string[] | readonly number[] | undefined
}

export interface HookArgs {
  readonly data: HookData
  readonly id?: string | undefined
  readonly collection?: string | undefined
}

export type HookFunction = (args: HookArgs) => HookData | undefined | Promise<HookData | undefined>

export interface CollectionHooks {
  readonly beforeValidate?: readonly HookFunction[] | undefined
  readonly beforeChange?: readonly HookFunction[] | undefined
  readonly afterChange?: readonly HookFunction[] | undefined
  readonly beforeRead?: readonly HookFunction[] | undefined
  readonly afterRead?: readonly HookFunction[] | undefined
  readonly beforeDelete?: readonly HookFunction[] | undefined
  readonly afterDelete?: readonly HookFunction[] | undefined
  readonly beforePublish?: readonly HookFunction[] | undefined
  readonly afterPublish?: readonly HookFunction[] | undefined
  readonly beforeUnpublish?: readonly HookFunction[] | undefined
  readonly afterUnpublish?: readonly HookFunction[] | undefined
}

export interface FieldHooks {
  readonly beforeValidate?: readonly HookFunction[] | undefined
  readonly beforeChange?: readonly HookFunction[] | undefined
  readonly afterChange?: readonly HookFunction[] | undefined
  readonly afterRead?: readonly HookFunction[] | undefined
}
