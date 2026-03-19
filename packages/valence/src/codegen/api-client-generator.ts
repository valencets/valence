import type { CollectionConfig } from '@valencets/cms'
import { pascalCase, singularize } from './naming.js'

export function generateApiClient (collection: CollectionConfig): string {
  const typeName = pascalCase(singularize(collection.slug))

  return `// @generated — regenerated from valence.config.ts. DO NOT EDIT.

import type { ${typeName} } from '../model/types.js'
import { apiClient } from '../../../shared/api/base-client.js'

const client = apiClient<${typeName}>('/api/${collection.slug}')

export const ${collection.slug} = {
  list: client.list,
  get: client.get,
  create: client.create,
  update: client.update,
  remove: client.remove
}
`
}
