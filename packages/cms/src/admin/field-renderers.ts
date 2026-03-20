import type { FieldConfig } from '../schema/field-types.js'
import { escapeHtml } from './escape.js'

export interface RelationOption {
  readonly id: string
  readonly label: string
}

export interface RelationContext {
  readonly [fieldName: string]: readonly RelationOption[]
}

const RENDERER_MAP: Record<string, (f: FieldConfig, value: string) => string> = {
  text: renderTextInput,
  slug: renderTextInput,
  textarea: renderTextarea,
  richtext: renderRichtextEditor,
  number: renderNumberInput,
  boolean: renderCheckbox,
  select: renderSelect,
  date: renderDateInput,
  media: renderMediaUpload,
  relation: renderRelation,
  group: renderGroup,
  email: renderEmailInput,
  url: renderUrlInput,
  password: renderPasswordInput,
  json: renderJsonTextarea,
  color: renderColorInput,
  multiselect: renderMultiselect,
  array: renderArrayField,
  blocks: renderBlocksField
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
  return `<label class="form-checkbox"><input type="hidden" name="${escapeHtml(f.name)}" value="false"><input type="checkbox" name="${escapeHtml(f.name)}" value="true"${checked}> ${escapeHtml(f.label ?? f.name)}</label>`
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

function renderRichtextEditor (f: FieldConfig, value: string): string {
  const templateTag = value
    ? `<template class="richtext-initial">${escapeHtml(value)}</template>`
    : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><div class="richtext-wrap"><input type="hidden" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"><div class="richtext-editor" data-field="${escapeHtml(f.name)}"></div>${templateTag}</div></label>`
}

function renderRelation (f: FieldConfig, value: string, context?: RelationContext): string {
  const options = context?.[f.name]
  if (!options) return renderTextInput(f, value)
  const req = f.required ? ' required' : ''
  const emptyOpt = f.required ? '' : '<option value="">— None —</option>'
  const optionTags = options.map(o => {
    const sel = o.id === value ? ' selected' : ''
    return `<option value="${escapeHtml(o.id)}"${sel}>${escapeHtml(o.label)}</option>`
  }).join('')
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><select class="form-select" name="${escapeHtml(f.name)}"${req}>${emptyOpt}${optionTags}</select></label>`
}

function renderGroup (f: FieldConfig, _value: string): string {
  const inner = 'fields' in f
    ? f.fields.map(child => renderFieldInput(child, '')).join('\n')
    : ''
  return `<fieldset><legend>${escapeHtml(f.label ?? f.name)}</legend>${inner}</fieldset>`
}

function renderMediaUpload (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  const preview = value
    ? `<div class="media-preview"><span>${escapeHtml(value)}</span></div>`
    : '<div class="media-preview"></div>'
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><div class="media-upload" data-upload-endpoint="/media/upload" data-field="${escapeHtml(f.name)}"><input type="hidden" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"><input type="file" class="form-input" accept="image/*,video/*,audio/*,application/pdf"${req}>${preview}</div></label>`
}

function renderEmailInput (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><input class="form-input" type="email" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"${req}></label>`
}

function renderUrlInput (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><input class="form-input" type="url" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"${req}></label>`
}

function renderPasswordInput (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><input class="form-input" type="password" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"${req}></label>`
}

function renderJsonTextarea (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><textarea class="form-json" name="${escapeHtml(f.name)}"${req}>${escapeHtml(value)}</textarea></label>`
}

function renderColorInput (f: FieldConfig, value: string): string {
  const req = f.required ? ' required' : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><input class="form-input" type="color" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"${req}></label>`
}

function renderMultiselect (f: FieldConfig, value: string): string {
  const selected = value ? value.split(',') : []
  const options = 'options' in f
    ? f.options.map(o => {
      const sel = selected.includes(o.value) ? ' selected' : ''
      return `<option value="${escapeHtml(o.value)}"${sel}>${escapeHtml(o.label)}</option>`
    }).join('')
    : ''
  return `<label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span><select class="form-select" name="${escapeHtml(f.name)}" multiple>${options}</select></label>`
}

function renderArrayField (f: FieldConfig, value: string): string {
  return `<div class="array-field"><label class="form-field"><span>${escapeHtml(f.label ?? f.name)}</span></label><input type="hidden" name="${escapeHtml(f.name)}" value="${escapeHtml(value)}"><div class="array-rows" data-field="${escapeHtml(f.name)}"></div><button type="button" class="array-add" data-field="${escapeHtml(f.name)}">+ Add row</button></div>`
}

function renderBlocksField (f: FieldConfig, value: string): string {
  let blocks: Array<{ blockType?: string; [key: string]: string | undefined }> = []
  if (value) {
    try { blocks = JSON.parse(value) } catch { blocks = [] }
  }
  const blockDefs = 'blocks' in f ? f.blocks : []
  const blockOptions = blockDefs.map(b => {
    const label = b.labels?.singular ?? b.slug
    return '<option value="' + escapeHtml(b.slug) + '">' + escapeHtml(label) + '</option>'
  }).join('')
  const blockFieldsets = blocks.map((block, i) => {
    const def = blockDefs.find(b => b.slug === block.blockType)
    if (!def) return ''
    const legend = def.labels?.singular ?? def.slug
    const fieldInputs = def.fields.map(child => {
      const childVal = block[child.name] ?? ''
      return renderFieldInput(child, childVal)
    }).join('\n')
    return '<fieldset class="blocks-item" data-block-index="' + i + '" data-block-type="' + escapeHtml(block.blockType ?? '') + '"><legend>' + escapeHtml(legend) + '</legend>' + fieldInputs + '<button type="button" class="blocks-remove">Remove</button></fieldset>'
  }).join('\n')
  const configJson = escapeHtml(JSON.stringify(blockDefs.map(b => ({ slug: b.slug, fields: b.fields.map(bf => ({ type: bf.type, name: bf.name })), labels: b.labels }))))
  return '<div class="blocks-field" data-blocks-config="' + configJson + '"><label class="form-field"><span>' + escapeHtml(f.label ?? f.name) + '</span></label><input type="hidden" name="' + escapeHtml(f.name) + '" value="' + escapeHtml(value) + '">' + blockFieldsets + '<div class="blocks-add"><select class="blocks-type-select">' + blockOptions + '</select><button type="button" class="blocks-add-btn">+ Add block</button></div></div>'
}

export function renderFieldInput (f: FieldConfig, value: string, context?: RelationContext): string {
  const renderer = RENDERER_MAP[f.type]
  if (!renderer) return `<p>Unsupported field type: ${escapeHtml(f.type)}</p>`
  if (f.type === 'relation') return renderRelation(f, value, context)
  return renderer(f, value)
}
