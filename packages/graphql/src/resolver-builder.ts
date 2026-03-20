/* eslint-disable no-restricted-syntax -- GraphQL resolvers must throw GraphQLError per the graphql-js
   API contract. The graphql-js library catches thrown errors and converts them to GraphQL error
   responses. This is the one legitimate project-wide exception to the no-throw rule. */
import { GraphQLError } from 'graphql'
import type { GraphQLFieldResolver } from 'graphql'
import type { IncomingMessage } from 'node:http'
import type { LocalApi, DocumentRow } from '@valencets/cms'
import type { CollectionConfig } from '@valencets/cms'
import type { PaginatedResult } from '@valencets/cms'
import { singularize, capitalize } from './schema-generator.js'

export interface GraphQLContext {
  readonly req?: IncomingMessage | undefined
}

export interface CollectionResolvers {
  readonly queries: Record<string, GraphQLFieldResolver<unknown, unknown>>
  readonly mutations: Record<string, GraphQLFieldResolver<unknown, unknown>>
}

interface ListArgs {
  readonly page?: number | undefined
  readonly limit?: number | undefined
  readonly sort?: string | undefined
  readonly dir?: 'asc' | 'desc' | undefined
  readonly search?: string | undefined
  readonly locale?: string | undefined
}

interface SingleArgs {
  readonly id: string
}

interface CreateArgs {
  readonly data: Record<string, string | number | boolean | null>
}

interface UpdateArgs {
  readonly id: string
  readonly data: Record<string, string | number | boolean | null>
}

interface DeleteArgs {
  readonly id: string
}

function buildOrderBy (
  sort: string | undefined,
  dir: string | undefined
): { field: string; direction: 'asc' | 'desc' } | undefined {
  if (sort === undefined) return undefined
  return { field: sort, direction: dir === 'desc' ? 'desc' : 'asc' }
}

function extractDocs (data: DocumentRow[] | PaginatedResult<DocumentRow>): readonly DocumentRow[] {
  if (Array.isArray(data)) return data
  return (data as PaginatedResult<DocumentRow>).docs
}

function buildListResolver (
  api: LocalApi,
  slug: string
): GraphQLFieldResolver<unknown, unknown> {
  return async (_source, args: ListArgs) => {
    const findArgs: Parameters<LocalApi['find']>[0] = {
      collection: slug,
      page: args.page,
      perPage: args.limit,
      search: args.search,
      locale: args.locale,
      orderBy: buildOrderBy(args.sort, args.dir)
    }
    const result = await api.find(findArgs)
    return result.match(
      (data) => extractDocs(data),
      (error) => { throw new GraphQLError(error.message) }
    )
  }
}

function buildSingleResolver (
  api: LocalApi,
  slug: string
): GraphQLFieldResolver<unknown, unknown> {
  return async (_source, args: SingleArgs) => {
    const result = await api.findByID({ collection: slug, id: args.id })
    return result.match(
      (doc) => doc,
      (error) => { throw new GraphQLError(error.message) }
    )
  }
}

function buildCountResolver (
  api: LocalApi,
  slug: string
): GraphQLFieldResolver<unknown, unknown> {
  return async () => {
    const result = await api.count({ collection: slug })
    return result.match(
      (count) => count,
      (error) => { throw new GraphQLError(error.message) }
    )
  }
}

function buildCreateResolver (
  api: LocalApi,
  slug: string
): GraphQLFieldResolver<unknown, unknown> {
  return async (_source, args: CreateArgs) => {
    const result = await api.create({ collection: slug, data: args.data })
    return result.match(
      (doc) => doc,
      (error) => { throw new GraphQLError(error.message) }
    )
  }
}

function buildUpdateResolver (
  api: LocalApi,
  slug: string
): GraphQLFieldResolver<unknown, unknown> {
  return async (_source, args: UpdateArgs) => {
    const result = await api.update({ collection: slug, id: args.id, data: args.data })
    return result.match(
      (doc) => doc,
      (error) => { throw new GraphQLError(error.message) }
    )
  }
}

function buildDeleteResolver (
  api: LocalApi,
  slug: string
): GraphQLFieldResolver<unknown, unknown> {
  return async (_source, args: DeleteArgs) => {
    const result = await api.delete({ collection: slug, id: args.id })
    return result.match(
      (doc) => doc,
      (error) => { throw new GraphQLError(error.message) }
    )
  }
}

export function buildCollectionResolvers (
  api: LocalApi,
  collections: readonly CollectionConfig[]
): Record<string, CollectionResolvers> {
  const result: Record<string, CollectionResolvers> = {}

  for (const collection of collections) {
    const slug = collection.slug
    const singular = singularize(slug)
    const typeName = capitalize(singular)

    result[slug] = {
      queries: {
        [slug]: buildListResolver(api, slug),
        [singular]: buildSingleResolver(api, slug),
        [`${slug}Count`]: buildCountResolver(api, slug)
      },
      mutations: {
        [`create${typeName}`]: buildCreateResolver(api, slug),
        [`update${typeName}`]: buildUpdateResolver(api, slug),
        [`delete${typeName}`]: buildDeleteResolver(api, slug)
      }
    }
  }

  return result
}
