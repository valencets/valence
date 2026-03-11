export function renderLoginForm (error?: string): string {
  const errorHtml = error ? `<p class="form-error">${error}</p>` : ''

  return `
<section class="section container">
  <h1>Admin Login</h1>
  <p class="prose">Enter your admin token to access the analytics dashboard.</p>
  ${errorHtml}
  <form action="/admin/hud" method="POST" class="login-form">
    <div class="form-group">
      <label for="token" class="form-label">Admin Token</label>
      <input type="password" id="token" name="token" class="form-input" required autocomplete="off" placeholder="Enter admin token">
    </div>
    <button type="submit" class="btn btn-primary">Sign In</button>
  </form>
</section>`
}
