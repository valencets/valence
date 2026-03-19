export { WhereOperator } from './query-types.js'
export type {
  SqlValue,
  WhereCondition,
  WhereClause,
  OrderByClause,
  PaginatedResult
} from './query-types.js'

export { createQueryBuilder } from './query-builder.js'
export type { QueryBuilderFactory, CollectionQueryBuilder, DocumentRow, DocumentData } from './query-builder.js'

export { getColumnType, getColumnConstraints } from './column-map.js'

export { generateCreateTable, generateCreateTableSql, generateAlterTableSql } from './migration-generator.js'
export type { MigrationOutput, SchemaChanges } from './migration-generator.js'

export { isValidIdentifier, sanitizeIdentifier, getValidFieldNames, isAllowedField, sanitizeOptionValue } from './sql-sanitize.js'

export { safeQuery } from './safe-query.js'

export { saveRevision, getRevisions, getRevision } from './revision-queries.js'
export type { RevisionRow } from './revision-queries.js'
