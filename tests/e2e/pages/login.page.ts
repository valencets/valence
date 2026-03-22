import { type Locator, type Page } from '@playwright/test'

export class LoginPage {
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly loginButton: Locator
  readonly errorMessage: Locator

  constructor (private readonly page: Page) {
    this.emailInput = page.getByLabel('Email')
    this.passwordInput = page.getByLabel('Password')
    this.loginButton = page.getByRole('button', { name: /sign\s*in/i })
    this.errorMessage = page.locator('.km-error')
  }

  async goto (): Promise<void> {
    await this.page.goto('/admin/login')
  }

  async login (email: string, password: string): Promise<void> {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.loginButton.click()
  }

  async getError (): Promise<string | null> {
    const count = await this.errorMessage.count()
    if (count === 0) return null
    return this.errorMessage.textContent()
  }
}
