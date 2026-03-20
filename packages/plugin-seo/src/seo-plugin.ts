import type { CmsConfig } from '@valencets/cms'
import type { CollectionConfig, HookArgs, HookData } from '@valencets/cms'

export interface SeoPluginDefaults {
  readonly metaTitleSuffix?: string | undefined
}

export interface SeoPluginOptions {
  readonly collections: readonly string[] | 'all'
  readonly titleField?: string | undefined
  readonly defaults?: SeoPluginDefaults | undefined
}

const SEO_GROUP = {
  type: 'group' as const,
  name: 'seo',
  label: 'SEO',
  fields: [
    { type: 'text' as const, name: 'metaTitle', label: 'Meta Title', maxLength: 60 },
    { type: 'textarea' as const, name: 'metaDescription', label: 'Meta Description', maxLength: 160 },
    { type: 'text' as const, name: 'ogImage', label: 'OG Image URL' },
    { type: 'boolean' as const, name: 'noIndex', label: 'No Index' }
  ]
}

function shouldTarget (slug: string, collections: readonly string[] | 'all'): boolean {
  if (collections === 'all') return true
  return collections.includes(slug)
}

function makeAutoTitleHook (titleField: string, suffix: string) {
  return async (args: HookArgs): Promise<HookData | undefined> => {
    const existingTitle = args.data['seo.metaTitle']
    if (existingTitle !== undefined && existingTitle !== null && existingTitle !== '') {
      return { ...args.data, 'seo.metaTitle': existingTitle }
    }
    const rawTitle = args.data[titleField]
    if (rawTitle === undefined || rawTitle === null) return args.data
    const title = String(rawTitle) + suffix
    return { ...args.data, 'seo.metaTitle': title }
  }
}

function injectSeoIntoCollection (col: CollectionConfig, opts: SeoPluginOptions): CollectionConfig {
  if (!shouldTarget(col.slug, opts.collections)) return col
  // Idempotency guard: skip if seo group already injected
  if (col.fields.some(f => f.name === 'seo')) return col

  const titleField = opts.titleField
  const suffix = opts.defaults?.metaTitleSuffix ?? ''

  const existingBeforeChange = col.hooks?.beforeChange ?? []
  const autoTitleHooks = titleField !== undefined
    ? [makeAutoTitleHook(titleField, suffix)]
    : []

  const beforeChange = [...existingBeforeChange, ...autoTitleHooks]

  return {
    ...col,
    fields: [...col.fields, SEO_GROUP],
    hooks: {
      ...col.hooks,
      beforeChange: beforeChange.length > 0 ? beforeChange : undefined
    }
  }
}

export function seoPlugin (opts: SeoPluginOptions): (config: CmsConfig) => CmsConfig {
  return (config) => ({
    ...config,
    collections: config.collections.map(col => injectSeoIntoCollection(col, opts))
  })
}
