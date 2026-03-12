import { describe, it, expect } from 'vitest'
import { renderAbout } from '../templates/about.js'
import { ABOUT } from '../config/about-content.js'

describe('renderAbout', () => {
  it('returns non-empty HTML', () => {
    const html = renderAbout()
    expect(html.length).toBeGreaterThan(0)
  })

  it('contains headline', () => {
    const html = renderAbout()
    expect(html).toContain(ABOUT.headline)
  })

  it('contains founder name and bio', () => {
    const html = renderAbout()
    expect(html).toContain(ABOUT.founder.name)
    expect(html).toContain('Software engineer')
  })

  it('says Forrest Blade, not Forrest Carlton', () => {
    const html = renderAbout()
    expect(html).toContain('Forrest Blade')
    expect(html).not.toContain('Forrest Carlton')
  })

  it('contains hardware section without brand names', () => {
    const html = renderAbout()
    expect(html).toContain(ABOUT.hardware.headline)
    expect(html).not.toContain('Raspberry Pi')
    expect(html).not.toContain('ZimaBoard')
    expect(html).not.toContain('N100')
    expect(html).not.toContain('NVMe')
    expect(html).not.toContain('WD Red')
    expect(html).not.toContain('Cloudflare')
  })

  it('has telemetry on hardware section', () => {
    const html = renderAbout()
    expect(html).toContain('data-telemetry-target="hardware-section"')
  })

  it('hardware section links to /services for full details', () => {
    const html = renderAbout()
    const hwStart = html.indexOf('hardware-section')
    const hwEnd = html.indexOf('<section', hwStart + 1)
    const hwHtml = html.substring(hwStart, hwEnd > -1 ? hwEnd : undefined)
    expect(hwHtml).toContain('href="/services"')
  })

  it('hardware section is concise (under 80 words visible)', () => {
    const html = renderAbout()
    const hwStart = html.indexOf('hardware-section')
    const hwEnd = html.indexOf('<section', hwStart + 1)
    const hwHtml = html.substring(hwStart, hwEnd > -1 ? hwEnd : undefined)
    const text = hwHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    const wordCount = text.split(' ').length
    expect(wordCount).toBeLessThan(80)
  })
})

describe('renderAbout proof section', () => {
  it('renders proof section with Why Inertia Exists', () => {
    const html = renderAbout()
    expect(html).toContain('Why Inertia Exists')
  })

  it('proof section has key value propositions', () => {
    const html = renderAbout()
    expect(html).toContain('load instantly')
    expect(html).toContain('physically own')
    expect(html).toContain('respect your customers')
  })

  it('proof section has telemetry', () => {
    const html = renderAbout()
    expect(html).toContain('data-telemetry-target="proof-section"')
  })
})

describe('renderAbout contact section', () => {
  it('renders contact form with id="contact"', () => {
    const html = renderAbout()
    expect(html).toContain('id="contact"')
  })

  it('contains contact form fields', () => {
    const html = renderAbout()
    expect(html).toContain('name="name"')
    expect(html).toContain('name="email"')
    expect(html).toContain('name="message"')
  })

  it('form posts to /contact', () => {
    const html = renderAbout()
    expect(html).toContain('action="/contact"')
  })

  it('has contact info bar', () => {
    const html = renderAbout()
    expect(html).toContain('972-815-7910')
    expect(html).toContain('mail@forrestblade.com')
  })

  it('does NOT link to /contact as a separate page', () => {
    const html = renderAbout()
    expect(html).not.toContain('href="/contact"')
  })
})
