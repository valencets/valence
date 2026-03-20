import { type Locator, type Page } from '@playwright/test'

export class EditPage {
  readonly heading: Locator
  readonly form: Locator
  readonly saveButton: Locator
  readonly deleteTrigger: Locator
  readonly deleteConfirm: Locator
  readonly deleteCancel: Locator
  readonly toast: Locator
  readonly toastMessage: Locator

  constructor (private readonly page: Page) {
    this.heading = page.locator('h1')
    this.form = page.locator('form.admin-form')
    this.saveButton = page.locator('button[type="submit"].btn-primary')
    this.deleteTrigger = page.locator('button.delete-trigger')
    this.deleteConfirm = page.locator('button#delete-confirm')
    this.deleteCancel = page.locator('button#delete-cancel')
    this.toast = page.locator('.toast')
    this.toastMessage = page.locator('.toast-message')
  }

  async goto (collection: string, id: string): Promise<void> {
    await this.page.goto(`/admin/${collection}/${id}/edit`)
  }

  async gotoNew (collection: string): Promise<void> {
    await this.page.goto(`/admin/${collection}/new`)
  }

  async fillField (name: string, value: string): Promise<void> {
    const input = this.page.locator(`input.form-input[name="${name}"], textarea[name="${name}"]`)
    await input.fill(value)
  }

  async checkField (name: string): Promise<void> {
    await this.page.locator(`input[type="checkbox"][name="${name}"]`).check()
  }

  async uncheckField (name: string): Promise<void> {
    await this.page.locator(`input[type="checkbox"][name="${name}"]`).uncheck()
  }

  async getFieldValue (name: string): Promise<string> {
    const input = this.page.locator(`input.form-input[name="${name}"], textarea[name="${name}"]`)
    return input.inputValue()
  }

  async save (): Promise<void> {
    await this.saveButton.click()
  }

  async confirmDelete (): Promise<void> {
    await this.deleteTrigger.click()
    await this.deleteConfirm.click()
  }
}
