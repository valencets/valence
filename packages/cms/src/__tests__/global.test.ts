import { describe, it, expect } from 'vitest'
import { global } from '../schema/global.js'
import type { GlobalConfig } from '../schema/global.js'
import { field } from '../schema/fields.js'

describe('global()', () => {
  it('returns a GlobalConfig with slug and fields', () => {
    const siteSettings = global({
      slug: 'site-settings',
      fields: [
        field.text({ name: 'siteName', required: true }),
        field.textarea({ name: 'siteDescription' })
      ]
    })
    expect(siteSettings.slug).toBe('site-settings')
    expect(siteSettings.fields).toHaveLength(2)
  })

  it('accepts labels', () => {
    const nav = global({
      slug: 'navigation',
      label: 'Site Navigation',
      fields: [
        field.group({
          name: 'links',
          fields: [field.text({ name: 'url' })]
        })
      ]
    })
    expect(nav.label).toBe('Site Navigation')
  })
})

describe('GlobalConfig type', () => {
  it('is assignable from global() return value', () => {
    const config: GlobalConfig = global({
      slug: 'footer',
      fields: [
        field.text({ name: 'copyright' }),
        field.boolean({ name: 'showSocial' })
      ]
    })
    expect(config.slug).toBe('footer')
  })
})
