import { describe, it, expect, vi } from 'vitest'
import { GraphQLError, graphql } from 'graphql'
import { okAsync, errAsync } from '@valencets/resultkit'
import { buildCollectionResolvers } from '../resolver-builder.js'
import { generateGraphQLSchema } from '../schema-generator.js'
import type { CollectionConfig } from '@valencets/cms'
import type { LocalApi } from '@valencets/cms'

// --- Mock collections ---

const postsCollection: CollectionConfig = {
  slug: 'posts',
  timestamps: true,
  fields: [
    { type: 'text', name: 'title' },
    { type: 'boolean', name: 'published' }
  ]
}

const commentsCollection: CollectionConfig = {
  slug: 'comments',
  timestamps: false,
  fields: [
    { type: 'text', name: 'body' }
  ]
}

// --- Mock LocalApi ---

function makeMockApi (): LocalApi {
  return {
    find: vi.fn().mockReturnValue(okAsync([])),
    findByID: vi.fn().mockReturnValue(okAsync(null)),
    create: vi.fn().mockReturnValue(okAsync({ id: '1', title: 'New Post' })),
    update: vi.fn().mockReturnValue(okAsync({ id: '1', title: 'Updated Post' })),
    delete: vi.fn().mockReturnValue(okAsync({ id: '1' })),
    count: vi.fn().mockReturnValue(okAsync(0)),
    findGlobal: vi.fn().mockReturnValue(okAsync(null)),
    updateGlobal: vi.fn().mockReturnValue(okAsync({ slug: 'test' })),
    unpublish: vi.fn().mockReturnValue(okAsync({ id: '1' }))
  } as unknown as LocalApi
}

// --- Tests ---

describe('buildCollectionResolvers', () => {
  describe('return shape', () => {
    it('returns a record keyed by collection slug', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      expect(resolvers['posts']).toBeDefined()
    })

    it('each entry has queries and mutations', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      expect(resolvers['posts']?.queries).toBeDefined()
      expect(resolvers['posts']?.mutations).toBeDefined()
    })

    it('handles multiple collections independently', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection, commentsCollection])
      expect(resolvers['posts']).toBeDefined()
      expect(resolvers['comments']).toBeDefined()
    })
  })

  describe('query resolvers', () => {
    it('list resolver is keyed by collection slug', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      expect(resolvers['posts']?.queries['posts']).toBeTypeOf('function')
    })

    it('single resolver is keyed by singular form', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      expect(resolvers['posts']?.queries['post']).toBeTypeOf('function')
    })

    it('count resolver is keyed by slug + Count', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      expect(resolvers['posts']?.queries['postsCount']).toBeTypeOf('function')
    })

    it('list resolver calls api.find with correct collection slug', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const listResolver = resolvers['posts']?.queries['posts']
      await listResolver?.({}, {}, {}, {} as never)
      expect(api.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts' }))
    })

    it('list resolver passes page arg to api.find', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const listResolver = resolvers['posts']?.queries['posts']
      await listResolver?.({}, { page: 2, limit: 10 }, {}, {} as never)
      expect(api.find).toHaveBeenCalledWith(expect.objectContaining({ page: 2, perPage: 10 }))
    })

    it('list resolver passes search arg to api.find', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const listResolver = resolvers['posts']?.queries['posts']
      await listResolver?.({}, { search: 'hello' }, {}, {} as never)
      expect(api.find).toHaveBeenCalledWith(expect.objectContaining({ search: 'hello' }))
    })

    it('list resolver passes sort and dir args to api.find', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const listResolver = resolvers['posts']?.queries['posts']
      await listResolver?.({}, { sort: 'title', dir: 'desc' }, {}, {} as never)
      expect(api.find).toHaveBeenCalledWith(expect.objectContaining({
        orderBy: { field: 'title', direction: 'desc' }
      }))
    })

    it('list resolver passes locale arg to api.find', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const listResolver = resolvers['posts']?.queries['posts']
      await listResolver?.({}, { locale: 'fr' }, {}, {} as never)
      expect(api.find).toHaveBeenCalledWith(expect.objectContaining({ locale: 'fr' }))
    })

    it('single resolver calls api.findByID with correct id', async () => {
      const api = makeMockApi()
      ;(api.findByID as ReturnType<typeof vi.fn>).mockReturnValue(okAsync({ id: 'abc', title: 'Post' }))
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const singleResolver = resolvers['posts']?.queries['post']
      await singleResolver?.({}, { id: 'abc' }, {}, {} as never)
      expect(api.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts', id: 'abc' }))
    })

    it('single resolver returns null when not found', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const singleResolver = resolvers['posts']?.queries['post']
      const result = await singleResolver?.({}, { id: 'missing' }, {}, {} as never)
      expect(result).toBeNull()
    })

    it('count resolver calls api.count with correct collection', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const countResolver = resolvers['posts']?.queries['postsCount']
      await countResolver?.({}, {}, {}, {} as never)
      expect(api.count).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts' }))
    })

    it('count resolver returns the count value', async () => {
      const api = makeMockApi()
      ;(api.count as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(42))
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const countResolver = resolvers['posts']?.queries['postsCount']
      const result = await countResolver?.({}, {}, {}, {} as never)
      expect(result).toBe(42)
    })
  })

  describe('mutation resolvers', () => {
    it('create mutation is keyed by createTypeName', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      expect(resolvers['posts']?.mutations['createPost']).toBeTypeOf('function')
    })

    it('update mutation is keyed by updateTypeName', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      expect(resolvers['posts']?.mutations['updatePost']).toBeTypeOf('function')
    })

    it('delete mutation is keyed by deleteTypeName', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      expect(resolvers['posts']?.mutations['deletePost']).toBeTypeOf('function')
    })

    it('create mutation calls api.create with collection slug and data', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const createResolver = resolvers['posts']?.mutations['createPost']
      const data = { title: 'Hello', published: true }
      await createResolver?.({}, { data }, {}, {} as never)
      expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts', data }))
    })

    it('update mutation calls api.update with collection slug, id, and data', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const updateResolver = resolvers['posts']?.mutations['updatePost']
      const data = { title: 'Updated' }
      await updateResolver?.({}, { id: '123', data }, {}, {} as never)
      expect(api.update).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts', id: '123', data }))
    })

    it('delete mutation calls api.delete with collection slug and id', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const deleteResolver = resolvers['posts']?.mutations['deletePost']
      await deleteResolver?.({}, { id: '456' }, {}, {} as never)
      expect(api.delete).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts', id: '456' }))
    })

    it('create mutation returns the created document', async () => {
      const api = makeMockApi()
      const doc = { id: '99', title: 'Brand New' }
      ;(api.create as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(doc))
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const createResolver = resolvers['posts']?.mutations['createPost']
      const result = await createResolver?.({}, { data: { title: 'Brand New' } }, {}, {} as never)
      expect(result).toEqual(doc)
    })
  })

  describe('error propagation', () => {
    it('list resolver throws GraphQLError when api.find returns err', async () => {
      const api = makeMockApi()
      ;(api.find as ReturnType<typeof vi.fn>).mockReturnValue(
        errAsync({ code: 'NOT_FOUND', message: 'Collection not found' })
      )
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const listResolver = resolvers['posts']?.queries['posts']
      await expect(listResolver?.({}, {}, {}, {} as never)).rejects.toBeInstanceOf(GraphQLError)
    })

    it('single resolver throws GraphQLError when api.findByID returns err', async () => {
      const api = makeMockApi()
      ;(api.findByID as ReturnType<typeof vi.fn>).mockReturnValue(
        errAsync({ code: 'INTERNAL_ERROR', message: 'DB error' })
      )
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const singleResolver = resolvers['posts']?.queries['post']
      await expect(singleResolver?.({}, { id: 'x' }, {}, {} as never)).rejects.toBeInstanceOf(GraphQLError)
    })

    it('create mutation throws GraphQLError when api.create returns err', async () => {
      const api = makeMockApi()
      ;(api.create as ReturnType<typeof vi.fn>).mockReturnValue(
        errAsync({ code: 'INVALID_INPUT', message: 'Validation failed' })
      )
      const resolvers = buildCollectionResolvers(api, [postsCollection])
      const createResolver = resolvers['posts']?.mutations['createPost']
      await expect(createResolver?.({}, { data: {} }, {}, {} as never)).rejects.toBeInstanceOf(GraphQLError)
    })
  })

  describe('multiple collections get separate resolver sets', () => {
    it('posts list resolver calls api.find with posts slug', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection, commentsCollection])
      const postsListResolver = resolvers['posts']?.queries['posts']
      await postsListResolver?.({}, {}, {}, {} as never)
      expect(api.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts' }))
    })

    it('comments list resolver calls api.find with comments slug', async () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection, commentsCollection])
      const commentsListResolver = resolvers['comments']?.queries['comments']
      await commentsListResolver?.({}, {}, {}, {} as never)
      expect(api.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'comments' }))
    })

    it('comments has separate mutation keys (createComment)', () => {
      const api = makeMockApi()
      const resolvers = buildCollectionResolvers(api, [postsCollection, commentsCollection])
      expect(resolvers['comments']?.mutations['createComment']).toBeTypeOf('function')
    })
  })
})

describe('generateGraphQLSchema with api', () => {
  it('accepts api parameter and returns a valid schema', () => {
    const api = makeMockApi()
    const schema = generateGraphQLSchema([postsCollection], api)
    expect(schema).toBeDefined()
  })

  it('resolver is wired — graphql() executes list query and calls api.find', async () => {
    const api = makeMockApi()
    ;(api.find as ReturnType<typeof vi.fn>).mockReturnValue(
      okAsync([{ id: '1', title: 'Hello' }])
    )
    const schema = generateGraphQLSchema([postsCollection], api)
    const result = await graphql({ schema, source: '{ posts { id title } }' })
    expect(result.errors).toBeUndefined()
    expect(api.find).toHaveBeenCalled()
  })

  it('resolver is wired — graphql() executes count query and calls api.count', async () => {
    const api = makeMockApi()
    ;(api.count as ReturnType<typeof vi.fn>).mockReturnValue(okAsync(7))
    const schema = generateGraphQLSchema([postsCollection], api)
    const result = await graphql({ schema, source: '{ postsCount }' })
    expect(result.errors).toBeUndefined()
    expect(result.data?.['postsCount']).toBe(7)
  })

  it('resolver errors surface as graphql errors in query result', async () => {
    const api = makeMockApi()
    ;(api.find as ReturnType<typeof vi.fn>).mockReturnValue(
      errAsync({ code: 'NOT_FOUND', message: 'Collection not found' })
    )
    const schema = generateGraphQLSchema([postsCollection], api)
    const result = await graphql({ schema, source: '{ posts { id } }' })
    expect(result.errors).toBeDefined()
    expect(result.errors?.length).toBeGreaterThan(0)
  })

  it('backward-compatible: generateGraphQLSchema still works without api (no resolvers)', () => {
    const schema = generateGraphQLSchema([postsCollection])
    expect(schema).toBeDefined()
  })
})
