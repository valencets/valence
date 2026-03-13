import { PRINCIPLES } from '../config/principles-content.js'

export function renderPrinciples (): string {
  const sections = PRINCIPLES.map((p, i) => `
    <article id="${p.id}" class="principle-section card" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="principle-${p.id}">
      <div class="principle-header">
        <span class="principle-number" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <h2>${p.title}</h2>
      </div>
      <div class="principle-details">
        <div class="principle-origin">
          <h3>Origin</h3>
          <p>${p.origin}</p>
        </div>
        <div class="principle-how">
          <h3>How We Apply It</h3>
          <p>${p.explanation}</p>
        </div>
        <div class="principle-benefit">
          <h3>What It Means For You</h3>
          <p>${p.benefit}</p>
        </div>
      </div>
    </article>`).join('')

  return `
<section class="section container">
  <h1>Engineering Principles</h1>
  <p class="prose">We borrow coding standards from aerospace engineering — not because websites need to fly, but because your business needs reliability you can bet on.</p>
</section>
<div class="container principles-grid">
  ${sections}
</div>
<section class="section container cta-section">
  <h2>Want to see these principles in action?</h2>
  <a href="/free-site-audit" class="btn btn-primary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="principles-audit-cta">Run a Free Audit</a>
</section>`
}
