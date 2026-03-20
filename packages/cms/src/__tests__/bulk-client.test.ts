// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'

describe('bulk-client initBulkActions()', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('is exported as a named function', async () => {
    const mod = await import('../admin/editor/bulk-client.js')
    expect(typeof mod.initBulkActions).toBe('function')
  })

  it('select-all checkbox toggles all row checkboxes to checked', async () => {
    document.body.innerHTML = `
      <div class="bulk-action-bar" style="display:none"><span class="bulk-count">0 selected</span></div>
      <input type="checkbox" class="bulk-select-all">
      <input type="checkbox" name="ids" value="1" class="bulk-row-check">
      <input type="checkbox" name="ids" value="2" class="bulk-row-check">
    `
    const { initBulkActions } = await import('../admin/editor/bulk-client.js')
    initBulkActions()
    const selectAll = document.querySelector<HTMLInputElement>('.bulk-select-all')!
    selectAll.checked = true
    selectAll.dispatchEvent(new Event('change', { bubbles: true }))
    const rows = document.querySelectorAll<HTMLInputElement>('.bulk-row-check')
    for (const row of rows) {
      expect(row.checked).toBe(true)
    }
  })

  it('select-all checkbox toggles all row checkboxes to unchecked', async () => {
    document.body.innerHTML = `
      <div class="bulk-action-bar" style="display:none"><span class="bulk-count">0 selected</span></div>
      <input type="checkbox" class="bulk-select-all">
      <input type="checkbox" name="ids" value="1" class="bulk-row-check" checked>
      <input type="checkbox" name="ids" value="2" class="bulk-row-check" checked>
    `
    const { initBulkActions } = await import('../admin/editor/bulk-client.js')
    initBulkActions()
    const selectAll = document.querySelector<HTMLInputElement>('.bulk-select-all')!
    selectAll.checked = false
    selectAll.dispatchEvent(new Event('change', { bubbles: true }))
    const rows = document.querySelectorAll<HTMLInputElement>('.bulk-row-check')
    for (const row of rows) {
      expect(row.checked).toBe(false)
    }
  })

  it('updates bulk-count text when select-all is checked', async () => {
    document.body.innerHTML = `
      <div class="bulk-action-bar" style="display:none"><span class="bulk-count">0 selected</span></div>
      <input type="checkbox" class="bulk-select-all">
      <input type="checkbox" name="ids" value="1" class="bulk-row-check">
      <input type="checkbox" name="ids" value="2" class="bulk-row-check">
      <input type="checkbox" name="ids" value="3" class="bulk-row-check">
    `
    const { initBulkActions } = await import('../admin/editor/bulk-client.js')
    initBulkActions()
    const selectAll = document.querySelector<HTMLInputElement>('.bulk-select-all')!
    selectAll.checked = true
    selectAll.dispatchEvent(new Event('change', { bubbles: true }))
    const count = document.querySelector('.bulk-count')!
    expect(count.textContent).toBe('3 selected')
  })

  it('shows bulk-action-bar when rows are selected', async () => {
    document.body.innerHTML = `
      <div class="bulk-action-bar" style="display:none"><span class="bulk-count">0 selected</span></div>
      <input type="checkbox" class="bulk-select-all">
      <input type="checkbox" name="ids" value="1" class="bulk-row-check">
      <input type="checkbox" name="ids" value="2" class="bulk-row-check">
    `
    const { initBulkActions } = await import('../admin/editor/bulk-client.js')
    initBulkActions()
    const selectAll = document.querySelector<HTMLInputElement>('.bulk-select-all')!
    selectAll.checked = true
    selectAll.dispatchEvent(new Event('change', { bubbles: true }))
    const bar = document.querySelector<HTMLElement>('.bulk-action-bar')!
    expect(bar.style.display).not.toBe('none')
  })

  it('hides bulk-action-bar when no rows are selected', async () => {
    document.body.innerHTML = `
      <div class="bulk-action-bar" style="display:none"><span class="bulk-count">0 selected</span></div>
      <input type="checkbox" class="bulk-select-all">
      <input type="checkbox" name="ids" value="1" class="bulk-row-check" checked>
    `
    const { initBulkActions } = await import('../admin/editor/bulk-client.js')
    initBulkActions()
    const selectAll = document.querySelector<HTMLInputElement>('.bulk-select-all')!
    selectAll.checked = false
    selectAll.dispatchEvent(new Event('change', { bubbles: true }))
    const bar = document.querySelector<HTMLElement>('.bulk-action-bar')!
    expect(bar.style.display).toBe('none')
  })

  it('updates count when individual row checkbox changes', async () => {
    document.body.innerHTML = `
      <div class="bulk-action-bar" style="display:none"><span class="bulk-count">0 selected</span></div>
      <input type="checkbox" class="bulk-select-all">
      <input type="checkbox" name="ids" value="1" class="bulk-row-check">
      <input type="checkbox" name="ids" value="2" class="bulk-row-check">
    `
    const { initBulkActions } = await import('../admin/editor/bulk-client.js')
    initBulkActions()
    const row = document.querySelector<HTMLInputElement>('.bulk-row-check')!
    row.checked = true
    row.dispatchEvent(new Event('change', { bubbles: true }))
    const count = document.querySelector('.bulk-count')!
    expect(count.textContent).toBe('1 selected')
  })

  it('shows action bar when individual row checkbox is checked', async () => {
    document.body.innerHTML = `
      <div class="bulk-action-bar" style="display:none"><span class="bulk-count">0 selected</span></div>
      <input type="checkbox" class="bulk-select-all">
      <input type="checkbox" name="ids" value="1" class="bulk-row-check">
    `
    const { initBulkActions } = await import('../admin/editor/bulk-client.js')
    initBulkActions()
    const row = document.querySelector<HTMLInputElement>('.bulk-row-check')!
    row.checked = true
    row.dispatchEvent(new Event('change', { bubbles: true }))
    const bar = document.querySelector<HTMLElement>('.bulk-action-bar')!
    expect(bar.style.display).not.toBe('none')
  })
})
