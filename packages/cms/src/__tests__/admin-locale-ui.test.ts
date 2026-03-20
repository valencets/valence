import { describe, it, expect } from 'vitest'
import { renderEditView } from '../admin/edit-view.js'
import type { EditViewLocaleConfig } from '../admin/edit-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

const localizedCol = collection({
  slug: 'posts',
  fields: [
    field.text({ name: 'title', required: true, localized: true }),
    field.text({ name: 'body', localized: true }),
    field.text({ name: 'slug', required: true })
  ]
})

const localeConfig: EditViewLocaleConfig = {
  currentLocale: 'en',
  defaultLocale: 'en',
  locales: [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' }
  ]
}

describe('edit view locale tabs', () => {
  it('renders locale tabs when localeConfig provided and collection has localized fields', () => {
    const html = renderEditView(localizedCol, null, '', undefined, undefined, localeConfig)
    expect(html).toContain('locale-tabs')
    expect(html).toContain('English')
    expect(html).toContain('Spanish')
  })

  it('marks current locale tab as active', () => {
    const html = renderEditView(localizedCol, null, '', undefined, undefined, localeConfig)
    expect(html).toContain('locale-tab-active')
    // The active tab should be English (currentLocale: 'en')
    expect(html).toContain('locale=en')
  })

  it('does NOT render locale tabs when localeConfig is not provided', () => {
    const html = renderEditView(localizedCol, null)
    expect(html).not.toContain('locale-tabs')
  })

  it('does NOT render locale tabs for collections without localized fields', () => {
    const nonLocalizedCol = collection({
      slug: 'tags',
      fields: [field.text({ name: 'name', required: true })]
    })
    const html = renderEditView(nonLocalizedCol, null, '', undefined, undefined, localeConfig)
    expect(html).not.toContain('locale-tabs')
  })

  it('extracts locale value from JSONB for localized fields', () => {
    const doc = {
      id: '1',
      title: JSON.stringify({ en: 'Hello', es: 'Hola' }),
      body: JSON.stringify({ en: 'English body' }),
      slug: 'hello'
    }
    const html = renderEditView(localizedCol, doc, '', undefined, undefined, localeConfig)
    expect(html).toContain('value="Hello"')
    expect(html).not.toContain('value="Hola"')
  })

  it('shows Spanish values when currentLocale is es', () => {
    const esConfig: EditViewLocaleConfig = { ...localeConfig, currentLocale: 'es' }
    const doc = {
      id: '1',
      title: JSON.stringify({ en: 'Hello', es: 'Hola' }),
      slug: 'hello'
    }
    const html = renderEditView(localizedCol, doc, '', undefined, undefined, esConfig)
    expect(html).toContain('value="Hola"')
  })

  it('shows empty value for missing locale in JSONB', () => {
    const frConfig: EditViewLocaleConfig = {
      currentLocale: 'fr',
      defaultLocale: 'en',
      locales: [{ code: 'en', label: 'English' }, { code: 'fr', label: 'French' }]
    }
    const doc = {
      id: '1',
      title: JSON.stringify({ en: 'Hello' }),
      slug: 'hello'
    }
    const html = renderEditView(localizedCol, doc, '', undefined, undefined, frConfig)
    // French value doesn't exist, should show empty
    expect(html).toContain('value=""')
  })
})
