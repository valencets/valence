import { describe, it, expect } from 'vitest'
import { WhereOperator } from '../db/query-types.js'
import type { WhereCondition, WhereClause, OrderByClause, PaginatedResult } from '../db/query-types.js'

describe('WhereOperator', () => {
  it('exposes all 9 operators', () => {
    expect(WhereOperator.EQUALS).toBe('equals')
    expect(WhereOperator.NOT_EQUALS).toBe('not_equals')
    expect(WhereOperator.GREATER_THAN).toBe('greater_than')
    expect(WhereOperator.LESS_THAN).toBe('less_than')
    expect(WhereOperator.GREATER_THAN_OR_EQUAL).toBe('greater_than_or_equal')
    expect(WhereOperator.LESS_THAN_OR_EQUAL).toBe('less_than_or_equal')
    expect(WhereOperator.LIKE).toBe('like')
    expect(WhereOperator.IN).toBe('in')
    expect(WhereOperator.EXISTS).toBe('exists')
  })

  it('has exactly 9 operators', () => {
    expect(Object.keys(WhereOperator)).toHaveLength(9)
  })
})

describe('WhereCondition', () => {
  it('accepts field, operator, value', () => {
    const cond: WhereCondition = {
      field: 'status',
      operator: 'equals',
      value: 'published'
    }
    expect(cond.field).toBe('status')
    expect(cond.operator).toBe('equals')
    expect(cond.value).toBe('published')
  })
})

describe('WhereClause', () => {
  it('accepts an array of conditions with and/or', () => {
    const clause: WhereClause = {
      and: [
        { field: 'status', operator: 'equals', value: 'published' },
        { field: 'order', operator: 'greater_than', value: 0 }
      ]
    }
    expect(clause.and).toHaveLength(2)
  })

  it('accepts or conditions', () => {
    const clause: WhereClause = {
      or: [
        { field: 'role', operator: 'equals', value: 'admin' },
        { field: 'role', operator: 'equals', value: 'editor' }
      ]
    }
    expect(clause.or).toHaveLength(2)
  })
})

describe('OrderByClause', () => {
  it('accepts field and direction', () => {
    const order: OrderByClause = { field: 'created_at', direction: 'desc' }
    expect(order.field).toBe('created_at')
    expect(order.direction).toBe('desc')
  })
})

describe('PaginatedResult', () => {
  it('wraps docs with pagination metadata', () => {
    const result: PaginatedResult<{ title: string }> = {
      docs: [{ title: 'Hello' }, { title: 'World' }],
      totalDocs: 50,
      page: 1,
      totalPages: 5,
      limit: 10,
      hasNextPage: true,
      hasPrevPage: false
    }
    expect(result.docs).toHaveLength(2)
    expect(result.totalPages).toBe(5)
    expect(result.hasNextPage).toBe(true)
  })
})
