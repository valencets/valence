import { describe, it, expect } from 'vitest'
import { renderAbout } from '../templates/about.js'
import { ABOUT } from '../config/about-content.js'
import { ABOUT_COPY_MAP } from '../config/about-copy-map.js'

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

  it('contains hardware section without brand names in visible copy', () => {
    const html = renderAbout()
    // Strip data-copy-technical attributes (technical copy is hidden by default)
    const visible = html.replace(/\s*data-copy-technical="[^"]*"/g, '')
    expect(visible).toContain(ABOUT.hardware.headline)
    // Must NOT contain hardware brand names on public-facing pages
    expect(visible).not.toContain('Raspberry Pi')
    expect(visible).not.toContain('ZimaBoard')
    expect(visible).not.toContain('N100')
    expect(visible).not.toContain('NVMe')
    expect(visible).not.toContain('WD Red')
    expect(visible).not.toContain('Cloudflare')
  })

  it('renders all hardware specs', () => {
    const html = renderAbout()
    for (const spec of ABOUT.hardware.specs) {
      expect(html).toContain(spec.label)
      expect(html).toContain(spec.value)
    }
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

  it('renders data-copy-technical attributes on spec values', () => {
    const html = renderAbout()
    expect(html).toContain('data-copy-technical=')
    expect(html).toContain('data-copy-default=')
  })

  it('spec values match about copy map defaults', () => {
    for (const entry of ABOUT_COPY_MAP) {
      const spec = ABOUT.hardware.specs.find(s => s.value === entry.default)
      expect(spec).toBeDefined()
    }
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
