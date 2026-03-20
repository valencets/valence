export default {
  ci: {
    collect: {
      numberOfRuns: 5,
      url: [
        'http://localhost:3111/admin/login',
        'http://localhost:3111/admin',
        'http://localhost:3111/admin/posts'
      ],
      settings: {
        // Use desktop preset for admin UI
        preset: 'desktop',
        // Skip service worker for test environment
        skipAudits: ['uses-http2']
      }
    },
    assert: {
      aggregationMethod: 'optimistic',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        // Core Web Vitals
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'experimental-interaction-to-next-paint': ['warn', { maxNumericValue: 200 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        // Resource budgets enforced via budget.json
        'resource-summary:document:size': ['warn', { maxNumericValue: 500_000 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 200_000 }],
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 50_000 }],
        'resource-summary:third-party:count': ['warn', { maxNumericValue: 0 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
}
