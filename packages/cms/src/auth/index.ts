export { isAuthEnabled, getAuthConfig } from './auth-config.js'
export type { AuthConfig } from './auth-config.js'

export { hashPassword, verifyPassword } from './password.js'

export { createSession, validateSession, destroySession } from './session.js'

export { createAuthMiddleware } from './middleware.js'
export type { AuthContext } from './middleware.js'
