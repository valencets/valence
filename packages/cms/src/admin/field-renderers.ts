import type { FieldConfig } from '../schema/field-types.js'
import { escapeHtml } from './escape.js'

const RENDERER_MAP: Record<string, (f: FieldConfig, value: string) => string> = {
  text: renderTextInput,
  slug: renderTextInput,
  textarea: renderTextarea,
  number: renderNumberInput,
  boolean: renderCheckbox,
  select: renderSelect,
  date: renderDateInput,
  media: renderTextInput,
  relation: renderTextInput,
  group: renderGroup
}

function renderTextInput (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><input class="form-input" type="text" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"${req}></label>`
}

function renderTextarea (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><textarea class="form-textarea" name="${escapeHtml(f.name)}"${req}>${escapeHtml(value)}</textarea></label>`
}

function renderNumberInput (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  let attrs = ''
  if ('min' in f && f.min !== undefined) attrs += ` min="${escapeHtml(String(f.min))}"`
  if ('max' in f && f.max !== undefined) attrs += ` max="${escapeHtml(String(f.max))}"`
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><input class="form-input" type="number" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"${attrs}${req}></label>`
}

function renderCheckbox (f: FieldConfig, value: string): string {
  const checked = value === 'true' ? ' checked' : ''
  return `<label class="form-checkbox"><input type="checkbox" name="${escapeHtml(f.name)}" value="true"${checked}> ${escapeHtml(f.label ?? f.name)}</label>`
}

function renderSelect (f: FieldConfig, value: string): string {
  const options = 'options' in f
    ? f.options.map(o => {
      const sel = o.value === value ? ' selected' : ''
      return `<option value="${escapeHtml(o.value)}"${sel}>${escapeHtml(o.label)}</option>`
    }).join('')
    : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><select class="form-select" name="${escapeHtml(f.name)}">${options}</select></label>`
}

function renderDateInput (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><input class="form-input" type="date" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"${req}></label>`
}

function renderGroup (f: FieldConfig, _value: string): string {
  const inner = 'fields' in f
    ? f.fields.map(child => renderFieldInput(child, '')).join('\n')
    : ''
  return `<fieldset><legend>${escapeHtml(f.label ?? f.name)}</legend>${inner}</fieldset>`
}

export function renderFieldInput (f: FieldConfig, value: string): string {
  const renderer = RENDERER_MAP[f.type]
  if (!renderer) return `<p>Unsupported field type: ${escapeHtml(f.type)}</p>`
  return renderer(f, value)
}
