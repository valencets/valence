import { describe, it, expect } from 'vitest'
import {
  GraphQLObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLString,
  GraphQLInt,
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInputObjectType,
  validateSchema,
  graphqlSync
} from 'graphql'
import { generateGraphQLSchema } from '../schema-generator.js'
import type { CollectionConfig } from '@valencets/cms'

const postsCollection: CollectionConfig = {
  slug: 'posts',
  timestamps: true,
  fields: [
    { type: 'text', name: 'title' },
    { type: 'textarea', name: 'body' },
    { type: 'boolean', name: 'published' },
    { type: 'number', name: 'views' },
    { type: 'number', name: 'rating', hasDecimals: true },
    { type: 'date', name: 'publishedAt' },
    { type: 'select', name: 'status', options: [{ label: 'Draft', value: 'draft' }, { label: 'Published', value: 'published' }] }
  ]
}

const usersCollection: CollectionConfig = {
  slug: 'users',
  timestamps: false,
  fields: [
    { type: 'text', name: 'name' },
    { type: 'email', name: 'email' }
  ]
}

const articlesWithRelation: CollectionConfig = {
  slug: 'articles',
  timestamps: true,
  fields: [
    { type: 'text', name: 'title' },
    { type: 'relation', name: 'author', relationTo: 'users' }
  ]
}

describe('generateGraphQLSchema', () => {
  describe('query fields', () => {
    it('generates list query field for collection', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const queryType = schema.getQueryType()
      expect(queryType).toBeDefined()
      const fields = queryType?.getFields() ?? {}
      expect(fields['posts']).toBeDefined()
    })

    it('generates single document query field', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const queryType = schema.getQueryType()
      const fields = queryType?.getFields() ?? {}
      expect(fields['post']).toBeDefined()
    })

    it('generates count query field', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const queryType = schema.getQueryType()
      const fields = queryType?.getFields() ?? {}
      expect(fields['postsCount']).toBeDefined()
    })

    it('list query returns GraphQLList type', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const queryType = schema.getQueryType()
      const fields = queryType?.getFields() ?? {}
      const postsField = fields['posts']
      expect(postsField?.type).toBeInstanceOf(GraphQLList)
    })

    it('count query returns GraphQLInt', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const queryType = schema.getQueryType()
      const fields = queryType?.getFields() ?? {}
      const postsCount = fields['postsCount']
      expect(postsCount?.type).toBe(GraphQLInt)
    })

    it('list query has page, limit, sort, search, locale args', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const queryType = schema.getQueryType()
      const fields = queryType?.getFields() ?? {}
      const postsField = fields['posts']
      const argNames = postsField?.args.map(a => a.name) ?? []
      expect(argNames).toContain('page')
      expect(argNames).toContain('limit')
      expect(argNames).toContain('sort')
      expect(argNames).toContain('search')
      expect(argNames).toContain('locale')
    })

    it('single query has required id arg', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const queryType = schema.getQueryType()
      const fields = queryType?.getFields() ?? {}
      const postField = fields['post']
      const idArg = postField?.args.find(a => a.name === 'id')
      expect(idArg).toBeDefined()
      expect(idArg?.type).toBeInstanceOf(GraphQLNonNull)
    })
  })

  describe('mutation fields', () => {
    it('generates createPost mutation', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const mutationType = schema.getMutationType()
      expect(mutationType).toBeDefined()
      const fields = mutationType?.getFields() ?? {}
      expect(fields['createPost']).toBeDefined()
    })

    it('generates updatePost mutation', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const mutationType = schema.getMutationType()
      const fields = mutationType?.getFields() ?? {}
      expect(fields['updatePost']).toBeDefined()
    })

    it('generates deletePost mutation', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const mutationType = schema.getMutationType()
      const fields = mutationType?.getFields() ?? {}
      expect(fields['deletePost']).toBeDefined()
    })

    it('createPost mutation has data arg with PostInput type', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const mutationType = schema.getMutationType()
      const fields = mutationType?.getFields() ?? {}
      const createField = fields['createPost']
      const dataArg = createField?.args.find(a => a.name === 'data')
      expect(dataArg).toBeDefined()
      expect(dataArg?.type).toBeInstanceOf(GraphQLNonNull)
    })

    it('updatePost mutation has id and data args', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const mutationType = schema.getMutationType()
      const fields = mutationType?.getFields() ?? {}
      const updateField = fields['updatePost']
      const argNames = updateField?.args.map(a => a.name) ?? []
      expect(argNames).toContain('id')
      expect(argNames).toContain('data')
    })

    it('deletePost mutation has required id arg', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const mutationType = schema.getMutationType()
      const fields = mutationType?.getFields() ?? {}
      const deleteField = fields['deletePost']
      const idArg = deleteField?.args.find(a => a.name === 'id')
      expect(idArg).toBeDefined()
      expect(idArg?.type).toBeInstanceOf(GraphQLNonNull)
    })
  })

  describe('document type', () => {
    it('document type has id field', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postType = schema.getType('Post') as GraphQLObjectType | undefined
      expect(postType).toBeDefined()
      const fields = postType?.getFields() ?? {}
      expect(fields['id']).toBeDefined()
      expect(fields['id']?.type).toBe(GraphQLString)
    })

    it('document type includes collection fields', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postType = schema.getType('Post') as GraphQLObjectType | undefined
      const fields = postType?.getFields() ?? {}
      expect(fields['title']).toBeDefined()
      expect(fields['body']).toBeDefined()
      expect(fields['published']).toBeDefined()
    })

    it('includes timestamps when collection.timestamps is true', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postType = schema.getType('Post') as GraphQLObjectType | undefined
      const fields = postType?.getFields() ?? {}
      expect(fields['created_at']).toBeDefined()
      expect(fields['updated_at']).toBeDefined()
    })

    it('excludes timestamps when collection.timestamps is false', () => {
      const schema = generateGraphQLSchema([usersCollection])
      const userType = schema.getType('User') as GraphQLObjectType | undefined
      const fields = userType?.getFields() ?? {}
      expect(fields['created_at']).toBeUndefined()
      expect(fields['updated_at']).toBeUndefined()
    })

    it('maps number without hasDecimals to GraphQLInt', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postType = schema.getType('Post') as GraphQLObjectType | undefined
      const fields = postType?.getFields() ?? {}
      expect(fields['views']?.type).toBe(GraphQLInt)
    })

    it('maps number with hasDecimals: true to GraphQLFloat', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postType = schema.getType('Post') as GraphQLObjectType | undefined
      const fields = postType?.getFields() ?? {}
      expect(fields['rating']?.type).toBe(GraphQLFloat)
    })

    it('maps boolean field correctly', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postType = schema.getType('Post') as GraphQLObjectType | undefined
      const fields = postType?.getFields() ?? {}
      expect(fields['published']?.type).toBe(GraphQLBoolean)
    })
  })

  describe('input type', () => {
    it('generates PostInput type', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postInputType = schema.getType('PostInput')
      expect(postInputType).toBeDefined()
      expect(postInputType).toBeInstanceOf(GraphQLInputObjectType)
    })

    it('PostInput has collection fields', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postInputType = schema.getType('PostInput') as GraphQLInputObjectType | undefined
      const fields = postInputType?.getFields() ?? {}
      expect(fields['title']).toBeDefined()
      expect(fields['body']).toBeDefined()
    })
  })

  describe('multiple collections', () => {
    it('generates separate types for multiple collections', () => {
      const schema = generateGraphQLSchema([postsCollection, usersCollection])
      const postType = schema.getType('Post')
      const userType = schema.getType('User')
      expect(postType).toBeDefined()
      expect(userType).toBeDefined()
    })

    it('generates query fields for each collection', () => {
      const schema = generateGraphQLSchema([postsCollection, usersCollection])
      const queryType = schema.getQueryType()
      const fields = queryType?.getFields() ?? {}
      expect(fields['posts']).toBeDefined()
      expect(fields['post']).toBeDefined()
      expect(fields['users']).toBeDefined()
      expect(fields['user']).toBeDefined()
    })

    it('generates mutation fields for each collection', () => {
      const schema = generateGraphQLSchema([postsCollection, usersCollection])
      const mutationType = schema.getMutationType()
      const fields = mutationType?.getFields() ?? {}
      expect(fields['createPost']).toBeDefined()
      expect(fields['createUser']).toBeDefined()
    })
  })

  describe('name derivation', () => {
    it('singularizes plural slug ending in "s" to form type name', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const postType = schema.getType('Post')
      expect(postType).toBeDefined()
    })

    it('handles slug ending in "ies" by converting to "y"', () => {
      const categoriesCollection: CollectionConfig = {
        slug: 'categories',
        timestamps: false,
        fields: [{ type: 'text', name: 'name' }]
      }
      const schema = generateGraphQLSchema([categoriesCollection])
      const categoryType = schema.getType('Category')
      expect(categoryType).toBeDefined()
    })

    it('count field is named slug + Count', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const queryType = schema.getQueryType()
      const fields = queryType?.getFields() ?? {}
      expect(fields['postsCount']).toBeDefined()
    })
  })

  describe('relation fields', () => {
    it('relation field references the related collection type', () => {
      const schema = generateGraphQLSchema([articlesWithRelation, usersCollection])
      const articleType = schema.getType('Article') as GraphQLObjectType | undefined
      const fields = articleType?.getFields() ?? {}
      const authorField = fields['author']
      const userType = schema.getType('User')
      expect(authorField?.type).toBe(userType)
    })

    it('relation field falls back to GraphQLString when collection not found', () => {
      const schema = generateGraphQLSchema([articlesWithRelation])
      const articleType = schema.getType('Article') as GraphQLObjectType | undefined
      const fields = articleType?.getFields() ?? {}
      const authorField = fields['author']
      expect(authorField?.type).toBe(GraphQLString)
    })
  })

  describe('schema validation', () => {
    it('generated schema passes GraphQL validation', () => {
      const schema = generateGraphQLSchema([postsCollection, usersCollection])
      const errors = validateSchema(schema)
      expect(errors).toHaveLength(0)
    })

    it('schema with multiple collections passes validation', () => {
      const schema = generateGraphQLSchema([postsCollection, usersCollection, articlesWithRelation])
      const errors = validateSchema(schema)
      expect(errors).toHaveLength(0)
    })

    it('introspection query works on generated schema', () => {
      const schema = generateGraphQLSchema([postsCollection])
      const result = graphqlSync({
        schema,
        source: '{ __typename }'
      })
      expect(result.errors).toBeUndefined()
      expect(result.data?.['__typename']).toBe('Query')
    })
  })
})
