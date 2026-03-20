import { describe, it, expect } from 'vitest'
import { renderListView } from '../admin/list-view.js'
import type { ListViewLocaleConfig } from '../admin/list-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

const localizedCol = collection({
  slug: 'posts',
  fields: [
    field.text({ name: 'title', required: true, localized: true }),
    field.text({ name: 'slug', required: true })
  ]
})

const nonLocalizedCol = collection({
  slug: 'tags',
  fields: [field.text({ name: 'name', required: true })]
})

const localeConfig: ListViewLocaleConfig = {
  currentLocale: 'en',
  locales: [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' }
  ]
}

describe('list view locale selector', () => {
  it('renders locale selector for collections with localized fields', () => {
    const html = renderListView({
      col: localizedCol,
      docs: [{ id: '1', title: '{"en":"Hello","es":"Hola"}', slug: 'hello' }],
      localeConfig
    })
    expect(html).toContain('locale-selector')
    expect(html).toContain('English')
    expect(html).toContain('Spanish')
  })

  it('does NOT render locale selector without localeConfig', () => {
    const html = renderListView({
      col: localizedCol,
      docs: [{ id: '1', title: 'Hello', slug: 'hello' }]
    })
    expect(html).not.toContain('locale-selector')
  })

  it('does NOT render locale selector for non-localized collections', () => {
    const html = renderListView({
      col: nonLocalizedCol,
      docs: [{ id: '1', name: 'tag1' }],
      localeConfig
    })
    expect(html).not.toContain('locale-selector')
  })

  it('extracts locale value from JSONB in table cells', () => {
    const html = renderListView({
      col: localizedCol,
      docs: [{ id: '1', title: '{"en":"Hello","es":"Hola"}', slug: 'hello' }],
      localeConfig
    })
    // Should show "Hello" not the raw JSONB
    expect(html).toContain('Hello')
    expect(html).not.toContain('{"en"')
  })

  it('shows Spanish values when currentLocale is es', () => {
    const esConfig: ListViewLocaleConfig = { ...localeConfig, currentLocale: 'es' }
    const html = renderListView({
      col: localizedCol,
      docs: [{ id: '1', title: '{"en":"Hello","es":"Hola"}', slug: 'hello' }],
      localeConfig: esConfig
    })
    expect(html).toContain('Hola')
  })

  it('non-localized fields show plain values', () => {
    const html = renderListView({
      col: localizedCol,
      docs: [{ id: '1', title: '{"en":"Hello"}', slug: 'hello' }],
      localeConfig
    })
    expect(html).toContain('hello')
  })

  it('marks current locale as selected in dropdown', () => {
    const html = renderListView({
      col: localizedCol,
      docs: [{ id: '1', title: '{"en":"Hello"}', slug: 'hello' }],
      localeConfig
    })
    expect(html).toContain('value="en" selected')
  })

  it('shows empty string for missing locale key in JSONB', () => {
    const frConfig: ListViewLocaleConfig = {
      currentLocale: 'fr',
      locales: [
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'French' }
      ]
    }
    const html = renderListView({
      col: localizedCol,
      docs: [{ id: '1', title: '{"en":"Hello"}', slug: 'hello' }],
      localeConfig: frConfig
    })
    // French value doesn't exist, cell should not show raw JSONB
    expect(html).not.toContain('{"en"')
  })
})
