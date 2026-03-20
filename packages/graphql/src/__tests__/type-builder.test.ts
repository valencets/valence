import { describe, it, expect } from 'vitest'
import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLList,
  GraphQLObjectType
} from 'graphql'
import { fieldToGraphQLType } from '../type-builder.js'
import type {
  TextFieldConfig,
  NumberFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  MultiselectFieldConfig,
  RelationFieldConfig,
  GroupFieldConfig,
  ArrayFieldConfig,
  DateFieldConfig,
  EmailFieldConfig,
  UrlFieldConfig,
  SlugFieldConfig,
  ColorFieldConfig,
  JsonFieldConfig,
  PasswordFieldConfig
} from '@valencets/cms'

describe('fieldToGraphQLType', () => {
  it('maps text → GraphQLString', () => {
    const field: TextFieldConfig = { type: 'text', name: 'title' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps textarea → GraphQLString', () => {
    const field = { type: 'textarea', name: 'body' } as const
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps richtext → GraphQLString', () => {
    const field = { type: 'richtext', name: 'content' } as const
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps number without hasDecimals → GraphQLInt', () => {
    const field: NumberFieldConfig = { type: 'number', name: 'count' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLInt)
  })

  it('maps number with hasDecimals: false → GraphQLInt', () => {
    const field: NumberFieldConfig = { type: 'number', name: 'count', hasDecimals: false }
    expect(fieldToGraphQLType(field)).toBe(GraphQLInt)
  })

  it('maps number with hasDecimals: true → GraphQLFloat', () => {
    const field: NumberFieldConfig = { type: 'number', name: 'price', hasDecimals: true }
    expect(fieldToGraphQLType(field)).toBe(GraphQLFloat)
  })

  it('maps boolean → GraphQLBoolean', () => {
    const field: BooleanFieldConfig = { type: 'boolean', name: 'published' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLBoolean)
  })

  it('maps select with options → GraphQLEnumType', () => {
    const field: SelectFieldConfig = {
      type: 'select',
      name: 'status',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' }
      ]
    }
    const result = fieldToGraphQLType(field)
    expect(result).toBeInstanceOf(GraphQLEnumType)
    const enumType = result as GraphQLEnumType
    expect(enumType.name).toBe('status_enum')
    const values = enumType.getValues()
    expect(values.map(v => v.name)).toEqual(['draft', 'published'])
  })

  it('maps multiselect → GraphQLList wrapping GraphQLEnumType', () => {
    const field: MultiselectFieldConfig = {
      type: 'multiselect',
      name: 'tags',
      options: [
        { label: 'Red', value: 'red' },
        { label: 'Blue', value: 'blue' }
      ]
    }
    const result = fieldToGraphQLType(field)
    expect(result).toBeInstanceOf(GraphQLList)
    const listType = result as GraphQLList<GraphQLEnumType>
    expect(listType.ofType).toBeInstanceOf(GraphQLEnumType)
    const enumType = listType.ofType
    expect(enumType.name).toBe('tags_enum')
  })

  it('maps relation → GraphQLString (UUID reference)', () => {
    const field: RelationFieldConfig = { type: 'relation', name: 'author', relationTo: 'users' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps group with children → GraphQLObjectType', () => {
    const field: GroupFieldConfig = {
      type: 'group',
      name: 'meta',
      fields: [
        { type: 'text', name: 'title' },
        { type: 'text', name: 'description' }
      ]
    }
    const result = fieldToGraphQLType(field)
    expect(result).toBeInstanceOf(GraphQLObjectType)
    const objType = result as GraphQLObjectType
    expect(objType.name).toBe('meta_group')
    const fields = objType.getFields()
    expect(Object.keys(fields)).toContain('title')
    expect(Object.keys(fields)).toContain('description')
  })

  it('maps array with children → GraphQLList(GraphQLObjectType)', () => {
    const field: ArrayFieldConfig = {
      type: 'array',
      name: 'items',
      fields: [
        { type: 'text', name: 'label' },
        { type: 'number', name: 'qty' }
      ]
    }
    const result = fieldToGraphQLType(field)
    expect(result).toBeInstanceOf(GraphQLList)
    const listType = result as GraphQLList<GraphQLObjectType>
    expect(listType.ofType).toBeInstanceOf(GraphQLObjectType)
    const objType = listType.ofType
    expect(objType.name).toBe('items_item')
  })

  it('maps date → GraphQLString', () => {
    const field: DateFieldConfig = { type: 'date', name: 'createdAt' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps email → GraphQLString', () => {
    const field: EmailFieldConfig = { type: 'email', name: 'userEmail' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps url → GraphQLString', () => {
    const field: UrlFieldConfig = { type: 'url', name: 'website' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps slug → GraphQLString', () => {
    const field: SlugFieldConfig = { type: 'slug', name: 'postSlug' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps color → GraphQLString', () => {
    const field: ColorFieldConfig = { type: 'color', name: 'bgColor' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps json → GraphQLString', () => {
    const field: JsonFieldConfig = { type: 'json', name: 'metadata' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps password → GraphQLString', () => {
    const field: PasswordFieldConfig = { type: 'password', name: 'userPassword' }
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps media → GraphQLString (UUID reference)', () => {
    const field = { type: 'media', name: 'thumbnail', relationTo: 'media' } as const
    expect(fieldToGraphQLType(field)).toBe(GraphQLString)
  })

  it('maps blocks → GraphQLList', () => {
    const field = {
      type: 'blocks',
      name: 'content',
      blocks: [
        {
          slug: 'hero',
          fields: [{ type: 'text' as const, name: 'heading' }]
        }
      ]
    } as const
    const result = fieldToGraphQLType(field)
    expect(result).toBeInstanceOf(GraphQLList)
  })
})
