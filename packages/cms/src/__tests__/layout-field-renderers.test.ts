import { describe, it, expect } from 'vitest'
import { field } from '../schema/fields.js'
import { renderFieldInput } from '../admin/field-renderers.js'

// --- Tabs renderer ---

describe('renderFieldInput — tabs', () => {
  const tabsField = field.tabs({
    name: 'content_tabs',
    tabs: [
      {
        label: 'Content',
        fields: [
          field.text({ name: 'title' }),
          field.textarea({ name: 'body' })
        ]
      },
      {
        label: 'SEO',
        fields: [
          field.text({ name: 'metaTitle' })
        ]
      }
    ]
  })

  it('returns HTML containing tabs-nav class', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('tabs-nav')
  })

  it('returns HTML containing tab-panel elements', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('tab-panel')
  })

  it('wraps output in a div with class tabs-field', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('class="tabs-field"')
  })

  it('renders data-field attribute with field name', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('data-field="content_tabs"')
  })

  it('renders tab buttons for each tab', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('<button')
    expect(html).toContain('type="button"')
    expect(html).toContain('tab-btn')
  })

  it('renders tab button labels matching TabDefinition labels', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('Content')
    expect(html).toContain('SEO')
  })

  it('first tab button has tab-active class', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('tab-btn tab-active')
  })

  it('second tab button does not have tab-active class', () => {
    const html = renderFieldInput(tabsField, '')
    // The second button should have tab-btn but not tab-active
    // We look for data-tab="1" button that doesn't have tab-active
    expect(html).toContain('data-tab="1"')
    // Verify tab-active appears only once (for first tab button)
    const activeMatches = html.match(/tab-active/g)
    expect(activeMatches).toHaveLength(2) // one for button, one for panel
  })

  it('first tab panel has tab-active class', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('class="tab-panel tab-active"')
  })

  it('second tab panel has style="display:none"', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('style="display:none"')
  })

  it('second tab panel has data-tab-panel="1"', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('data-tab-panel="1"')
  })

  it('children inside tabs are rendered as field inputs', () => {
    const html = renderFieldInput(tabsField, '')
    // title text field should be rendered
    expect(html).toContain('name="title"')
    // body textarea should be rendered
    expect(html).toContain('name="body"')
    // metaTitle text field in second tab should be rendered
    expect(html).toContain('name="metaTitle"')
  })

  it('escapes HTML in tab labels', () => {
    const xssField = field.tabs({
      name: 'tabs',
      tabs: [
        {
          label: '<script>alert(1)</script>',
          fields: []
        }
      ]
    })
    const html = renderFieldInput(xssField, '')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

// --- Row renderer ---

describe('renderFieldInput — row', () => {
  const rowField = field.row({
    name: 'name_row',
    fields: [
      field.text({ name: 'firstName' }),
      field.text({ name: 'lastName' }),
      field.text({ name: 'middleName' })
    ]
  })

  it('wraps output in a div with class row-field', () => {
    const html = renderFieldInput(rowField, '')
    expect(html).toContain('class="row-field"')
  })

  it('applies display:grid style', () => {
    const html = renderFieldInput(rowField, '')
    expect(html).toContain('display:grid')
  })

  it('applies grid-template-columns with repeat(N, 1fr) based on child count', () => {
    const html = renderFieldInput(rowField, '')
    expect(html).toContain('grid-template-columns:repeat(3,1fr)')
  })

  it('applies gap:1rem style', () => {
    const html = renderFieldInput(rowField, '')
    expect(html).toContain('gap:1rem')
  })

  it('renders children inline inside the row', () => {
    const html = renderFieldInput(rowField, '')
    expect(html).toContain('name="firstName"')
    expect(html).toContain('name="lastName"')
    expect(html).toContain('name="middleName"')
  })

  it('renders 2-column row correctly', () => {
    const twoColRow = field.row({
      name: 'two_col',
      fields: [
        field.text({ name: 'a' }),
        field.text({ name: 'b' })
      ]
    })
    const html = renderFieldInput(twoColRow, '')
    expect(html).toContain('grid-template-columns:repeat(2,1fr)')
  })
})

// --- Collapsible renderer ---

describe('renderFieldInput — collapsible', () => {
  const collapsibleField = field.collapsible({
    name: 'advanced_settings',
    label: 'Advanced Settings',
    fields: [
      field.text({ name: 'customClass' }),
      field.text({ name: 'customId' })
    ]
  })

  it('renders a <details> element', () => {
    const html = renderFieldInput(collapsibleField, '')
    expect(html).toContain('<details')
  })

  it('renders with class collapsible-field', () => {
    const html = renderFieldInput(collapsibleField, '')
    expect(html).toContain('class="collapsible-field"')
  })

  it('renders a <summary> element with the label', () => {
    const html = renderFieldInput(collapsibleField, '')
    expect(html).toContain('<summary>')
    expect(html).toContain('Advanced Settings')
    expect(html).toContain('</summary>')
  })

  it('has open attribute by default when collapsed is not set', () => {
    const html = renderFieldInput(collapsibleField, '')
    expect(html).toContain(' open')
  })

  it('has open attribute when collapsed is false', () => {
    const notCollapsed = field.collapsible({
      name: 'settings',
      label: 'Settings',
      collapsed: false,
      fields: []
    })
    const html = renderFieldInput(notCollapsed, '')
    expect(html).toContain(' open')
  })

  it('does NOT have open attribute when collapsed is true', () => {
    const collapsed = field.collapsible({
      name: 'settings',
      label: 'Settings',
      collapsed: true,
      fields: []
    })
    const html = renderFieldInput(collapsed, '')
    expect(html).not.toContain(' open')
  })

  it('renders children inside the collapsible', () => {
    const html = renderFieldInput(collapsibleField, '')
    expect(html).toContain('name="customClass"')
    expect(html).toContain('name="customId"')
  })

  it('escapes HTML in label', () => {
    const xssField = field.collapsible({
      name: 'settings',
      label: '<script>evil()</script>',
      fields: []
    })
    const html = renderFieldInput(xssField, '')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

// --- Container fields pass formData to children ---

describe('renderFieldInput — group with formData', () => {
  const groupField = field.group({
    name: 'meta',
    label: 'Meta',
    fields: [
      field.text({ name: 'metaTitle' }),
      field.textarea({ name: 'metaDescription' })
    ]
  })

  it('renders child inputs with values from formData', () => {
    const formData = { metaTitle: 'My Title', metaDescription: 'My description' }
    const html = renderFieldInput(groupField, '', undefined, undefined, formData)
    expect(html).toContain('value="My Title"')
    expect(html).toContain('My description</textarea>')
  })

  it('renders empty child inputs when formData is not provided', () => {
    const html = renderFieldInput(groupField, '')
    expect(html).toContain('value=""')
    expect(html).toContain('name="metaTitle"')
    expect(html).toContain('name="metaDescription"')
  })

  it('renders empty string for children missing from formData', () => {
    const formData = { metaTitle: 'Only Title' }
    const html = renderFieldInput(groupField, '', undefined, undefined, formData)
    expect(html).toContain('value="Only Title"')
    // metaDescription is missing from formData, should get empty string
    expect(html).toContain('name="metaDescription"')
    expect(html).toContain('></textarea>')
  })
})

describe('renderFieldInput — tabs with formData', () => {
  const tabsField = field.tabs({
    name: 'content_tabs',
    tabs: [
      {
        label: 'Content',
        fields: [
          field.text({ name: 'title' }),
          field.textarea({ name: 'body' })
        ]
      },
      {
        label: 'SEO',
        fields: [
          field.text({ name: 'seoTitle' })
        ]
      }
    ]
  })

  it('renders child inputs with values from formData across tabs', () => {
    const formData = { title: 'Hello', body: 'World', seoTitle: 'SEO Hello' }
    const html = renderFieldInput(tabsField, '', undefined, undefined, formData)
    expect(html).toContain('value="Hello"')
    expect(html).toContain('World</textarea>')
    expect(html).toContain('value="SEO Hello"')
  })

  it('renders empty child inputs when formData is not provided', () => {
    const html = renderFieldInput(tabsField, '')
    expect(html).toContain('name="title"')
    expect(html).toContain('name="seoTitle"')
  })
})

describe('renderFieldInput — row with formData', () => {
  const rowField = field.row({
    name: 'name_row',
    fields: [
      field.text({ name: 'firstName' }),
      field.text({ name: 'lastName' })
    ]
  })

  it('renders child inputs with values from formData', () => {
    const formData = { firstName: 'Jane', lastName: 'Doe' }
    const html = renderFieldInput(rowField, '', undefined, undefined, formData)
    expect(html).toContain('value="Jane"')
    expect(html).toContain('value="Doe"')
  })

  it('renders empty child inputs when formData is not provided', () => {
    const html = renderFieldInput(rowField, '')
    expect(html).toContain('name="firstName"')
    expect(html).toContain('name="lastName"')
  })
})

describe('renderFieldInput — collapsible with formData', () => {
  const collapsibleField = field.collapsible({
    name: 'advanced',
    label: 'Advanced',
    fields: [
      field.text({ name: 'cssClass' }),
      field.text({ name: 'htmlId' })
    ]
  })

  it('renders child inputs with values from formData', () => {
    const formData = { cssClass: 'hero-section', htmlId: 'main-hero' }
    const html = renderFieldInput(collapsibleField, '', undefined, undefined, formData)
    expect(html).toContain('value="hero-section"')
    expect(html).toContain('value="main-hero"')
  })

  it('renders empty child inputs when formData is not provided', () => {
    const html = renderFieldInput(collapsibleField, '')
    expect(html).toContain('name="cssClass"')
    expect(html).toContain('name="htmlId"')
  })
})
