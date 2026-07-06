import type { StoreDefinition, MutationDefinition } from '../types.js'
import type { StoreFieldConfig } from '../fields/store-field-types.js'

function fieldToTsType (field: StoreFieldConfig): string {
  const typeMap: Readonly<{ [type: string]: string | undefined }> = Object.freeze({
    text: 'string',
    textarea: 'string',
    number: 'number',
    boolean: 'boolean',
    date: 'string',
    email: 'string',
    url: 'string',
    color: 'string',
    slug: 'string',
    json: 'unknown'
  })

  if (field.type === 'select' && 'options' in field) {
    return field.options.map(o => `'${o}'`).join(' | ')
  }

  if (field.type === 'multiselect' && 'options' in field) {
    const union = field.options.map(o => `'${o}'`).join(' | ')
    return `Array<${union}>`
  }

  if (field.type === 'array' && 'fields' in field) {
    const props = field.fields.map(f => `    readonly ${f.name}: ${fieldToTsType(f)}`).join('\n')
    return `Array<{\n${props}\n  }>`
  }

  if (field.type === 'group' && 'fields' in field) {
    const props = field.fields.map(f => `    readonly ${f.name}: ${fieldToTsType(f)}`).join('\n')
    return `{\n${props}\n  }`
  }

  if (field.type === 'custom') {
    return 'unknown'
  }

  return typeMap[field.type] ?? 'unknown'
}

function generateStateInterface (config: StoreDefinition): string {
  const fields = config.fields.map(f => {
    return `  readonly ${f.name}: ${fieldToTsType(f)}`
  }).join('\n')

  return `interface ${pascalCase(config.slug)}State {\n${fields}\n}`
}

function generateMutationInputType (name: string, mutation: MutationDefinition): string {
  if (mutation.input.length === 0) {
    return `interface ${pascalCase(name)}Input {}`
  }
  const fields = mutation.input.map(f => {
    return `  readonly ${f.name}: ${fieldToTsType(f)}`
  }).join('\n')
  return `interface ${pascalCase(name)}Input {\n${fields}\n}`
}

function generateMutationsInterface (config: StoreDefinition): string {
  const methods = Object.keys(config.mutations).map(name => {
    return `  readonly ${name}: (args: ${pascalCase(name)}Input) => Promise<Result<void, StoreError>>`
  }).join('\n')

  return `interface ${pascalCase(config.slug)}Mutations {\n${methods}\n}`
}

function pascalCase (slug: string): string {
  return slug
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function generateDerivedInterface (config: StoreDefinition): string {
  const names = Object.keys(config.derived ?? {})
  if (names.length === 0) {
    return '  readonly derived: {}'
  }
  const props = names.map(name => `    readonly ${name}: ReadonlySignal<StoreValue>`).join('\n')
  return `  readonly derived: {\n${props}\n  }`
}

export function generateStoreModule (config: StoreDefinition): string {
  const stateInterface = generateStateInterface(config)
  const mutationInputTypes = Object.entries(config.mutations)
    .map(([name, mutation]) => generateMutationInputType(name, mutation))
    .join('\n\n')
  const mutationsInterface = generateMutationsInterface(config)
  const pascal = pascalCase(config.slug)

  return `// @generated — regenerated from valence.config.ts. DO NOT EDIT.

import { createStoreClient, createPostMutation, readHydrationState } from '@valencets/store/client'
import type { StoreClient } from '@valencets/store/client'
import type { Signal, ReadonlySignal } from '@valencets/reactive'
import type { Result } from '@valencets/resultkit'
import type { StoreError, StoreDefinition, StoreValue } from '@valencets/store'

${stateInterface}

${mutationInputTypes}

${mutationsInterface}

/** Reference shape of this store's client — annotate call sites with the
 *  precise state and input types exported above. */
export interface ${pascal}Store {
  readonly signals: {
${config.fields.map(f => `    readonly ${f.name}: Signal<${fieldToTsType(f)}>`).join('\n')}
  }
  readonly mutations: ${pascal}Mutations
${generateDerivedInterface(config)}
  readonly pendingCount: number
  readonly applyServerState: (state: ${pascal}State) => void
  readonly dispose: () => void
}

/**
 * Runtime factory. Pass the shared store definition (the same object given
 * to valence.config.ts) — mutation server fns never reach the browser
 * because only the client-safe parts are read here.
 */
export function create${pascal}Store (definition: StoreDefinition): StoreClient {
  return createStoreClient(definition, readHydrationState('${config.slug}'), createPostMutation())
}
`
}
