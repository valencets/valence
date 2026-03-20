import type { CmsConfig, CollectionConfig, HookArgs, HookData } from '@valencets/cms'

export interface NestedDocsPluginOptions {
  readonly collections: readonly string[]
  readonly parentField?: string | undefined
  readonly breadcrumbField?: string | undefined
  readonly labelField?: string | undefined
}

interface BreadcrumbEntry {
  readonly id: string
  readonly label: string
}

function makeBreadcrumbHook (breadcrumbFieldName: string, titleFieldName: string) {
  return async (args: HookArgs): Promise<HookData | undefined> => {
    const id = args.id ?? ''
    const rawTitle = args.data[titleFieldName]
    const label = rawTitle !== undefined && rawTitle !== null ? String(rawTitle) : ''

    const entry: BreadcrumbEntry = { id, label }
    const breadcrumbs: readonly BreadcrumbEntry[] = [entry]

    return {
      ...args.data,
      [breadcrumbFieldName]: JSON.stringify(breadcrumbs)
    }
  }
}

function injectNestedDocFields (col: CollectionConfig, opts: NestedDocsPluginOptions): CollectionConfig {
  if (!opts.collections.includes(col.slug)) return col

  const parentFieldName = opts.parentField ?? 'parent'
  const breadcrumbFieldName = opts.breadcrumbField ?? 'breadcrumbs'

  // Idempotency guard: skip if parent/breadcrumbs fields already injected
  if (col.fields.some(f => f.name === parentFieldName) || col.fields.some(f => f.name === breadcrumbFieldName)) {
    return col
  }

  const labelFieldName = opts.labelField ?? 'title'

  const parentRelationField = {
    type: 'relation' as const,
    name: parentFieldName,
    label: 'Parent',
    relationTo: col.slug
  }

  const breadcrumbsJsonField = {
    type: 'json' as const,
    name: breadcrumbFieldName,
    label: 'Breadcrumbs'
  }

  const existingAfterChange = col.hooks?.afterChange ?? []
  const breadcrumbHook = makeBreadcrumbHook(breadcrumbFieldName, labelFieldName)
  const afterChange = [...existingAfterChange, breadcrumbHook]

  return {
    ...col,
    fields: [...col.fields, parentRelationField, breadcrumbsJsonField],
    hooks: {
      ...col.hooks,
      afterChange
    }
  }
}

export function nestedDocsPlugin (opts: NestedDocsPluginOptions): (config: CmsConfig) => CmsConfig {
  return (config) => ({
    ...config,
    collections: config.collections.map(col => injectNestedDocFields(col, opts))
  })
}
