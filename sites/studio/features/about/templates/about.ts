import { ABOUT } from '../config/about-content.js'

export function renderAbout (): string {
  const specs = ABOUT.hardware.specs.map((s) => `
    <div class="spec-row">
      <dt>${s.label}</dt>
      <dd>${s.value}</dd>
    </div>`).join('')

  return `
<section class="section container">
  <h1>${ABOUT.headline}</h1>
  <p class="prose">${ABOUT.intro}</p>
</section>

<section class="section container">
  <h2>${ABOUT.founder.name}</h2>
  <p class="prose">${ABOUT.founder.bio}</p>
  <p class="prose">${ABOUT.founder.philosophy}</p>
</section>

<section class="section container" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="hardware-section">
  <h2>${ABOUT.hardware.headline}</h2>
  <p class="prose">${ABOUT.hardware.body}</p>
  <p class="prose">${ABOUT.hardware.pitch}</p>
  <dl class="spec-list card">
    ${specs}
  </dl>
</section>

<section class="section container cta-section">
  <h2>Want a website you actually own?</h2>
  <a href="/contact" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="about-contact-cta">Let's Talk</a>
</section>`
}
