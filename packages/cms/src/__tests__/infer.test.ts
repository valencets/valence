import { describe, it, expectTypeOf } from 'vitest'
import type { InferFieldType, InferFieldsType } from '../schema/infer.js'
import type { TextFieldConfig, NumberFieldConfig, BooleanFieldConfig, SelectFieldConfig, DateFieldConfig, SlugFieldConfig, RelationFieldConfig, MediaFieldConfig, TextareaFieldConfig } from '../schema/field-types.js'

describe('InferFieldType', () => {
  it('maps text → string', () => {
    expectTypeOf<InferFieldType<TextFieldConfig>>().toEqualTypeOf<string>()
  })

  it('maps textarea → string', () => {
    expectTypeOf<InferFieldType<TextareaFieldConfig>>().toEqualTypeOf<string>()
  })

  it('maps number → number', () => {
    expectTypeOf<InferFieldType<NumberFieldConfig>>().toEqualTypeOf<number>()
  })

  it('maps boolean → boolean', () => {
    expectTypeOf<InferFieldType<BooleanFieldConfig>>().toEqualTypeOf<boolean>()
  })

  it('maps select → string', () => {
    expectTypeOf<InferFieldType<SelectFieldConfig>>().toEqualTypeOf<string>()
  })

  it('maps date → Date', () => {
    expectTypeOf<InferFieldType<DateFieldConfig>>().toEqualTypeOf<Date>()
  })

  it('maps slug → string', () => {
    expectTypeOf<InferFieldType<SlugFieldConfig>>().toEqualTypeOf<string>()
  })

  it('maps media → string', () => {
    expectTypeOf<InferFieldType<MediaFieldConfig>>().toEqualTypeOf<string>()
  })

  it('maps relation → string', () => {
    expectTypeOf<InferFieldType<RelationFieldConfig>>().toEqualTypeOf<string>()
  })
})

describe('InferFieldsType', () => {
  it('infers an object shape from a fields tuple', () => {
    type Fields = readonly [
      { readonly type: 'text'; readonly name: 'title' },
      { readonly type: 'number'; readonly name: 'order' },
      { readonly type: 'boolean'; readonly name: 'active' }
    ]
    type Result = InferFieldsType<Fields>
    expectTypeOf<Result>().toHaveProperty('title')
    expectTypeOf<Result['title']>().toEqualTypeOf<string>()
    expectTypeOf<Result>().toHaveProperty('order')
    expectTypeOf<Result['order']>().toEqualTypeOf<number>()
    expectTypeOf<Result>().toHaveProperty('active')
    expectTypeOf<Result['active']>().toEqualTypeOf<boolean>()
  })
})
