import type { ServerConfig } from './types.js'

export function loadConfig (): ServerConfig {
  return {
    port: Number(process.env['STUDIO_PORT'] ?? 3000),
    host: process.env['STUDIO_HOST'] ?? '0.0.0.0',
    db: {
      host: process.env['DB_HOST'] ?? 'localhost',
      port: Number(process.env['DB_PORT'] ?? 5432),
      database: process.env['DB_NAME'] ?? 'inertia_studio',
      username: process.env['DB_USER'] ?? 'inertia_app',
      password: process.env['DB_PASSWORD'] ?? 'changeme',
      max: Number(process.env['DB_MAX_CONNECTIONS'] ?? 10),
      idle_timeout: 20,
      connect_timeout: 10
    },
    adminToken: process.env['ADMIN_TOKEN'] ?? '',
    contactEmail: 'mail@forrestblade.com',
    siteId: process.env['SITE_ID'] ?? 'studio',
    businessType: process.env['BUSINESS_TYPE'] ?? 'other',
    siteSecret: process.env['SITE_SECRET'] ?? '',
    studioEndpoint: process.env['STUDIO_ENDPOINT'] ?? ''
  }
}
