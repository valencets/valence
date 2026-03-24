import { describe, it, expect } from 'vitest'
import { renderLoginPage } from '../admin/login-view.js'

describe('renderLoginPage (Kinetic Monolith)', () => {
  const html = renderLoginPage({ csrfToken: 'test-csrf-token' })

  describe('structure', () => {
    it('renders a full HTML document', () => {
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('<html lang="en">')
    })

    it('has the correct page title', () => {
      expect(html).toContain('<title>Sign In')
      expect(html).toContain('Valence CMS')
    })

    it('includes the admin client script with CSP nonce placeholder', () => {
      expect(html).toContain('src="/admin/_assets/admin-client.js"')
      expect(html).toContain('__CSP_NONCE__')
    })
  })

  describe('Kinetic Monolith design', () => {
    it('has the kinetic background', () => {
      expect(html).toContain('km-kinetic-bg')
    })

    it('has background glow orbs', () => {
      expect(html).toContain('km-glow-primary')
      expect(html).toContain('km-glow-tertiary')
    })

    it('has the glassmorphism card', () => {
      expect(html).toContain('km-card')
    })

    it('has the gradient accent line', () => {
      expect(html).toContain('km-accent-line')
    })

    it('has the gradient submit button', () => {
      expect(html).toContain('km-gradient-btn')
    })

    it('uses KM surface tokens not raw grays', () => {
      expect(html).toContain('--km-surface')
      expect(html).toContain('--km-surface-low')
      expect(html).toContain('--km-on-surface')
    })

    it('imports Manrope and Inter fonts', () => {
      expect(html).toContain('Manrope')
      expect(html).toContain('Inter')
    })
  })

  describe('brand', () => {
    it('displays Valence CMS heading', () => {
      expect(html).toContain('Valence CMS')
    })

    it('has the admin console subtitle', () => {
      expect(html).toMatch(/admin\s*console/i)
    })
  })

  describe('form', () => {
    it('has a POST form to /admin/login', () => {
      expect(html).toContain('method="POST"')
      expect(html).toContain('action="/admin/login"')
    })

    it('includes the CSRF token as hidden input', () => {
      expect(html).toContain('name="_csrf"')
      expect(html).toContain('value="test-csrf-token"')
    })

    it('has a val-input for email', () => {
      expect(html).toContain('<val-input')
      expect(html).toContain('name="email"')
      expect(html).toContain('type="email"')
    })

    it('has a val-input for password', () => {
      expect(html).toContain('name="password"')
      expect(html).toContain('type="password"')
    })

    it('has uppercase tracked labels', () => {
      expect(html).toContain('km-label')
    })

    it('has a val-button submit', () => {
      expect(html).toContain('<val-button')
      expect(html).toContain('type="submit"')
      expect(html).toMatch(/sign\s*in/i)
    })

    it('has password label in val-input slot', () => {
      expect(html).toContain('slot="label"')
      expect(html).toContain('Password')
    })
  })

  describe('error handling', () => {
    it('does not show error div when none provided', () => {
      const noError = renderLoginPage({ csrfToken: 'tok' })
      expect(noError).not.toContain('<div class="km-error">')
    })

    it('shows escaped error message when provided', () => {
      const withError = renderLoginPage({ csrfToken: 'tok', error: 'Bad <script>creds' })
      expect(withError).toContain('km-error')
      expect(withError).toContain('Bad &lt;script&gt;creds')
      expect(withError).not.toContain('<script>creds')
    })
  })

  describe('status bar', () => {
    it('has the pulsing status dot', () => {
      expect(html).toContain('km-status-dot')
    })
  })
})
