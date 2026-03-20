export { isAuthEnabled, getAuthConfig, getAuthFields, injectAuthFields } from './auth-config.js'
export type { AuthConfig } from './auth-config.js'

export { hashPassword, verifyPassword } from './password.js'

export { createSession, DEFAULT_SESSION_MAX_AGE, validateSession, destroySession, destroyUserSessions, buildSessionCookie, buildExpiredSessionCookie } from './session.js'

export { createAuthMiddleware, createCmsAuthValidator, createCmsAuthGuard } from './middleware.js'
export type { AuthContext, AuthMiddleware, CmsAuthGuardOptions } from './middleware.js'

export { generateCsrfToken, validateCsrfToken } from './csrf.js'

export { createAuthRoutes } from './auth-routes.js'
export { parseCookie } from './cookie.js'

export { createRateLimiter } from './rate-limit.js'
export type { RateLimiter } from './rate-limit.js'

export { generateToken, hashToken, verifyToken, TokenErrorCode } from './token-utils.js'
export type { TokenError } from './token-utils.js'

export { createCustomSession, validateCustomSession, destroyCustomSession, SessionErrorCode } from './custom-session.js'
export type { SessionError } from './custom-session.js'
