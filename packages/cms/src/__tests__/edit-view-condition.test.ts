import { describe, it, expect } from 'vitest'
import { renderEditView } from '../admin/edit-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

const premiumCol = collection({
  slug: 'articles',
  fields: [
    field.text({ name: 'type' }),
    field.text({
      name: 'premiumContent',
      condition: (data) => data['type'] === 'premium'
    })
  ]
})

describe('edit view condition evaluation', () => {
  it('does NOT render field when condition returns false', () => {
    const doc = { id: '1', type: 'free', premiumContent: 'secret' }
    const html = renderEditView(premiumCol, doc)
    expect(html).not.toContain('name="premiumContent"')
  })

  it('DOES render field when condition returns true', () => {
    const doc = { id: '1', type: 'premium', premiumContent: 'secret' }
    const html = renderEditView(premiumCol, doc)
    expect(html).toContain('name="premiumContent"')
  })

  it('renders all fields when doc is null (new document)', () => {
    const html = renderEditView(premiumCol, null)
    expect(html).toContain('name="type"')
    expect(html).toContain('name="premiumContent"')
  })

  it('always renders fields without a condition', () => {
    const doc = { id: '1', type: 'free', premiumContent: '' }
    const html = renderEditView(premiumCol, doc)
    expect(html).toContain('name="type"')
  })

  it('handles multiple conditional fields independently', () => {
    const multiCol = collection({
      slug: 'products',
      fields: [
        field.text({ name: 'category' }),
        field.text({
          name: 'digitalLink',
          condition: (data) => data['category'] === 'digital'
        }),
        field.text({
          name: 'shippingWeight',
          condition: (data) => data['category'] === 'physical'
        })
      ]
    })
    const docDigital = { id: '1', category: 'digital' }
    const htmlDigital = renderEditView(multiCol, docDigital)
    expect(htmlDigital).toContain('name="digitalLink"')
    expect(htmlDigital).not.toContain('name="shippingWeight"')

    const docPhysical = { id: '2', category: 'physical' }
    const htmlPhysical = renderEditView(multiCol, docPhysical)
    expect(htmlPhysical).not.toContain('name="digitalLink"')
    expect(htmlPhysical).toContain('name="shippingWeight"')
  })

  it('uses string coercion for non-string doc values in formData', () => {
    const colWithNum = collection({
      slug: 'scores',
      fields: [
        field.number({ name: 'score' }),
        field.text({
          name: 'bonus',
          condition: (data) => data['score'] === '100'
        })
      ]
    })
    const docHigh = { id: '1', score: 100 }
    const htmlHigh = renderEditView(colWithNum, docHigh)
    expect(htmlHigh).toContain('name="bonus"')

    const docLow = { id: '2', score: 50 }
    const htmlLow = renderEditView(colWithNum, docLow)
    expect(htmlLow).not.toContain('name="bonus"')
  })
})
