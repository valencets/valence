export { isAuthEnabled, getAuthConfig, getAuthFields, injectAuthFields } from './auth-config.js'
export type { AuthConfig } from './auth-config.js'

export { hashPassword, verifyPassword } from './password.js'

export { createSession, validateSession, destroySession, buildSessionCookie, buildExpiredSessionCookie } from './session.js'

export { createAuthMiddleware } from './middleware.js'
export type { AuthContext, AuthMiddleware } from './middleware.js'

export { generateCsrfToken, validateCsrfToken } from './csrf.js'

export { createAuthRoutes } from './auth-routes.js'
export { parseCookie } from './cookie.js'

export { createRateLimiter } from './rate-limit.js'
export type { RateLimiter } from './rate-limit.js'
