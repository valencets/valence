import type { CollectionConfig } from '../schema/collection.js'
import type { SelectFieldConfig, BooleanFieldConfig } from '../schema/field-types.js'
import { escapeHtml } from './escape.js'

export interface DocumentRow {
  readonly id: string
  readonly [key: string]: string | number | boolean | null
}

export interface ListViewPagination {
  readonly totalDocs: number
  readonly page: number
  readonly totalPages: number
  readonly hasNextPage: boolean
  readonly hasPrevPage: boolean
}

export interface ListViewLocaleConfig {
  readonly currentLocale: string
  readonly locales: readonly { readonly code: string; readonly label: string }[]
}

export interface ListViewArgs {
  readonly col: CollectionConfig
  readonly docs: readonly DocumentRow[]
  readonly pagination?: ListViewPagination | undefined
  readonly query?: string | undefined
  readonly sort?: string | undefined
  readonly dir?: 'asc' | 'desc' | undefined
  readonly filters?: Record<string, string> | undefined
  readonly localeConfig?: ListViewLocaleConfig | undefined
}

function baseParams (args: ListViewArgs): Record<string, string> {
  const p: Record<string, string> = {}
  if (args.query) p.q = args.query
  if (args.sort) p.sort = args.sort
  if (args.dir) p.dir = args.dir
  if (args.filters) {
    for (const [k, v] of Object.entries(args.filters)) {
      if (v) p[k] = v
    }
  }
  return p
}

function buildQuery (base: Record<string, string>, overrides: Record<string, string>): string {
  const merged: Record<string, string> = { ...base }
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== '') merged[k] = v
    else delete merged[k]
  }
  return new URLSearchParams(merged).toString()
}

function renderSearchBar (args: ListViewArgs): string {
  const val = escapeHtml(args.query ?? '')
  return `<form method="GET" class="list-search">
  <input type="search" name="q" value="${val}" placeholder="Search\u2026" class="form-input">
  <button type="submit" class="btn btn-primary">Search</button>
</form>`
}

function sortLink (args: ListViewArgs, fieldName: string, label: string): string {
  const isActive = args.sort === fieldName
  const nextDir = isActive && args.dir === 'asc' ? 'desc' : 'asc'
  const arrow = isActive ? (args.dir === 'asc' ? ' \u25b2' : ' \u25bc') : ''
  const base = baseParams(args)
  const qs = buildQuery(base, { sort: fieldName, dir: nextDir })
  return `<a href="?${qs}">${escapeHtml(label)}${arrow}</a>`
}

function renderSelectFilter (args: ListViewArgs, f: SelectFieldConfig): string {
  const name = `filter_${f.name}`
  const current = args.filters?.[name] ?? ''
  const options = f.options.map(o => {
    const sel = current === o.value ? ' selected' : ''
    return `<option value="${escapeHtml(o.value)}"${sel}>${escapeHtml(o.label)}</option>`
  }).join('')
  return `<label class="list-filter-label">${escapeHtml(f.label ?? f.name)}
  <select name="${name}" class="form-select" onchange="this.form.submit()">
    <option value="">All</option>
    ${options}
  </select>
</label>`
}

function renderBooleanFilter (args: ListViewArgs, f: BooleanFieldConfig): string {
  const name = `filter_${f.name}`
  const current = args.filters?.[name] ?? ''
  const base = baseParams(args)
  const allQs = buildQuery(base, { [name]: '' })
  const trueQs = buildQuery(base, { [name]: 'true' })
  const falseQs = buildQuery(base, { [name]: 'false' })
  const allClass = current === '' ? ' filter-active' : ''
  const trueClass = current === 'true' ? ' filter-active' : ''
  const falseClass = current === 'false' ? ' filter-active' : ''
  const label = escapeHtml(f.label ?? f.name)
  return `<span class="list-filter-label">${label}:
  <a href="?${allQs}" class="filter-link${allClass}">All</a>
  <a href="?${trueQs}" class="filter-link${trueClass}">Yes</a>
  <a href="?${falseQs}" class="filter-link${falseClass}">No</a>
</span>`
}

function renderFilters (args: ListViewArgs): string {
  const parts: string[] = []
  for (const f of args.col.fields) {
    if (f.type === 'select') parts.push(renderSelectFilter(args, f))
    if (f.type === 'boolean') parts.push(renderBooleanFilter(args, f))
  }
  if (parts.length === 0) return ''
  return `<form method="GET" class="list-filters">${parts.join('\n')}</form>`
}

function paginationLink (label: string, page: number, args: ListViewArgs, disabled: boolean): string {
  if (disabled) {
    return `<span class="pagination-link" aria-disabled="true">${escapeHtml(label)}</span>`
  }
  const base = baseParams(args)
  const qs = buildQuery(base, { page: String(page) })
  return `<a href="?${qs}" class="pagination-link">${escapeHtml(label)}</a>`
}

function renderPagination (args: ListViewArgs): string {
  const p = args.pagination
  if (p === undefined || p.totalPages <= 1) return ''
  const first = paginationLink('First', 1, args, !p.hasPrevPage)
  const prev = paginationLink('Prev', p.page - 1, args, !p.hasPrevPage)
  const next = paginationLink('Next', p.page + 1, args, !p.hasNextPage)
  const last = paginationLink('Last', p.totalPages, args, !p.hasNextPage)
  return `<nav class="pagination">
  ${first}
  ${prev}
  <span class="pagination-info">Page ${p.page} of ${p.totalPages}</span>
  ${next}
  ${last}
</nav>`
}

function safeParseJson (str: string): Record<string, string> | null {
  try { return JSON.parse(str) } catch { return null }
}

function renderLocaleSelector (args: ListViewArgs): string {
  const config = args.localeConfig
  if (!config) return ''
  const hasLocalizedFields = args.col.fields.some(f => f.localized)
  if (!hasLocalizedFields) return ''

  const options = config.locales.map(l => {
    const sel = l.code === config.currentLocale ? ' selected' : ''
    return `<option value="${escapeHtml(l.code)}"${sel}>${escapeHtml(l.label)}</option>`
  }).join('')

  return `<select name="locale" class="form-select locale-selector" onchange="window.location.search='locale='+this.value">
    ${options}
  </select>`
}

function resolveCellValue (raw: string | number | boolean | null, localized: boolean | undefined, localeConfig: ListViewLocaleConfig | undefined): string {
  if (localized && localeConfig && raw !== null && raw !== undefined) {
    if (typeof raw === 'string') {
      const parsed = safeParseJson(raw)
      if (parsed !== null) {
        return String(parsed[localeConfig.currentLocale] ?? '')
      }
    }
  }
  return String(raw ?? '')
}

function renderTable (args: ListViewArgs): string {
  const { col, docs } = args
  const displayFields = col.fields.slice(0, 3)
  const headerCells = displayFields.map(f => {
    const label = f.label ?? f.name
    return `<th>${sortLink(args, f.name, label)}</th>`
  }).join('')
  const rows = docs.map(doc => {
    const cells = displayFields.map(f => {
      const cellValue = resolveCellValue(doc[f.name] ?? null, f.localized, args.localeConfig)
      return `<td>${escapeHtml(cellValue)}</td>`
    }).join('')
    const safeId = escapeHtml(doc.id)
    const safeSlug = escapeHtml(col.slug)
    return `<tr><td><a href="/admin/${safeSlug}/${safeId}/edit">${safeId.slice(0, 8)}\u2026</a></td>${cells}<td class="actions-cell"><a href="/admin/${safeSlug}/${safeId}/edit" class="action-link">Edit</a></td></tr>`
  }).join('\n')
  return `<table>
  <thead><tr><th>ID</th>${headerCells}<th>Actions</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`
}

export function renderListView (args: ListViewArgs): string {
  const { col, docs } = args
  const label = escapeHtml(col.labels?.plural ?? col.slug)
  const safeSlug = escapeHtml(col.slug)
  const singularLabel = escapeHtml(col.labels?.singular ?? col.slug)

  if (docs.length === 0 && !args.query && !args.filters) {
    return `<div class="empty-state"><p>No ${label} found.</p><a href="/admin/${safeSlug}/new">Create one</a></div>`
  }

  const searchBar = renderSearchBar(args)
  const localeSelector = renderLocaleSelector(args)
  const filters = renderFilters(args)
  const table = docs.length === 0
    ? `<div class="empty-state"><p>No ${label} found.</p></div>`
    : renderTable(args)
  const pagination = renderPagination(args)

  return `
<div class="list-header">
  ${searchBar}
  ${localeSelector}
  <a href="/admin/${safeSlug}/new" class="btn btn-primary">New ${singularLabel}</a>
</div>
${filters}
${table}
${pagination}`
}
