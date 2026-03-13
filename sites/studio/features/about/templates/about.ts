import { ABOUT } from '../config/about-content.js'
import { SUBJECTS } from '../../contact/schemas/contact-schema.js'

export function renderAbout (): string {
  const proofItems = ABOUT.proof.points.map((p) =>
    `<li>${p}</li>`
  ).join('')

  const subjectOptions = SUBJECTS.map((s) =>
    `<option value="${s}">${s}</option>`
  ).join('')

  return `
<section class="section container">
  <h1>${ABOUT.headline}</h1>
  <p class="prose">${ABOUT.intro}</p>
</section>

<section class="section container" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="proof-section">
  <h2>${ABOUT.proof.headline}</h2>
  <ul>${proofItems}</ul>
</section>

<section class="section container" data-telemetry-type="VIEWPORT_INTERSECT" data-telemetry-target="hardware-section">
  <h2>${ABOUT.hardware.headline}</h2>
  <p class="prose">${ABOUT.hardware.summary}</p>
  <a href="${ABOUT.hardware.cta.href}" class="btn btn-secondary" data-telemetry-type="INTENT_NAVIGATE" data-telemetry-target="about-services-link">${ABOUT.hardware.cta.label}</a>
</section>

<section class="section container" id="contact">
  <h2>Get in Touch</h2>
  <form method="POST" action="/contact" data-telemetry-type="FORM_INPUT" data-telemetry-target="contact-form">
    <div class="form-group">
      <label for="name" class="form-label">Name *</label>
      <input type="text" id="name" name="name" class="form-input" required>
    </div>

    <div class="form-group">
      <label for="email" class="form-label">Email *</label>
      <input type="email" id="email" name="email" class="form-input" required>
    </div>

    <div class="form-group">
      <label for="business" class="form-label">Business</label>
      <input type="text" id="business" name="business" class="form-input">
    </div>

    <div class="form-group">
      <label for="subject" class="form-label">Subject *</label>
      <select id="subject" name="subject" class="form-select" required>
        <option value="">Select subject...</option>
        ${subjectOptions}
      </select>
    </div>

    <div class="form-group">
      <label for="message" class="form-label">Message *</label>
      <textarea id="message" name="message" class="form-textarea" required></textarea>
    </div>

    <button type="submit" class="btn btn-primary" data-telemetry-type="CLICK" data-telemetry-target="contact-submit">Send Message</button>
  </form>

  <div class="contact-info">
    <span>Reach out directly.</span>
    <a href="tel:+19728157910" data-telemetry-type="INTENT_CALL" data-telemetry-target="contact-phone">972-815-7910</a>
    <a href="mailto:mail@forrestblade.com" data-telemetry-type="INTENT_LEAD" data-telemetry-target="contact-email">mail@forrestblade.com</a>
  </div>
</section>

<section class="section container">
  <h2>${ABOUT.founder.name}</h2>
  <p class="prose">${ABOUT.founder.bio}</p>
  <p class="prose">${ABOUT.founder.philosophy}</p>
</section>`
}
