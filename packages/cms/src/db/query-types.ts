export const WhereOperator = {
  EQUALS: 'equals',
  NOT_EQUALS: 'not_equals',
  GREATER_THAN: 'greater_than',
  LESS_THAN: 'less_than',
  GREATER_THAN_OR_EQUAL: 'greater_than_or_equal',
  LESS_THAN_OR_EQUAL: 'less_than_or_equal',
  LIKE: 'like',
  IN: 'in',
  EXISTS: 'exists'
} as const

export type WhereOperator = typeof WhereOperator[keyof typeof WhereOperator]

export type SqlValue = string | number | boolean | null | readonly string[] | readonly number[]

export interface WhereCondition {
  readonly field: string
  readonly operator: WhereOperator
  readonly value: SqlValue
}

export interface WhereClause {
  readonly and?: readonly WhereCondition[] | undefined
  readonly or?: readonly WhereCondition[] | undefined
}

export interface OrderByClause {
  readonly field: string
  readonly direction: 'asc' | 'desc'
}

export interface PaginatedResult<T> {
  readonly docs: readonly T[]
  readonly totalDocs: number
  readonly page: number
  readonly totalPages: number
  readonly limit: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
}

export interface SearchConfig {
  readonly fields?: readonly string[] | undefined
  readonly language?: string | undefined
}
