import { PAGE_TOKEN_CSS } from './page-tokens.js'

export function landingPage (port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Valence — Schema-driven CMS for TypeScript</title>
  <meta name="description" content="One config generates your database, admin UI, REST API, and typed frontend. Schema-driven CMS framework for TypeScript.">
  <style>
    ${PAGE_TOKEN_CSS}

    /* --- Reset --- */
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      font-family: var(--val-font-sans);
      background: var(--val-color-bg);
      color: var(--val-color-text);
      line-height: var(--val-leading-normal);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* --- Layout --- */
    .page { max-width: 64rem; margin: 0 auto; padding: 0 var(--val-space-6); }

    /* --- Nav --- */
    .nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--val-space-5) 0;
      border-bottom: 1px solid var(--val-color-border);
    }
    .nav-brand {
      font-size: var(--val-text-lg);
      font-weight: var(--val-weight-semibold);
      color: var(--val-color-text);
      text-decoration: none;
      letter-spacing: 0.04em;
    }
    .nav-brand span { color: var(--val-green-400); }
    .nav-links { display: flex; gap: var(--val-space-4); align-items: center; }
    .nav-link {
      color: var(--val-color-text-muted);
      text-decoration: none;
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      transition: color var(--val-duration-fast) var(--val-ease-out);
    }
    .nav-link:hover { color: var(--val-color-text); }

    /* --- Hero --- */
    .hero {
      padding: var(--val-space-24) 0 var(--val-space-16);
      text-align: center;
    }
    .hero-badge {
      display: inline-block;
      font-size: var(--val-text-xs);
      font-weight: var(--val-weight-semibold);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--val-green-400);
      border: 1px solid var(--val-green-600);
      border-radius: var(--val-radius-full);
      padding: var(--val-space-1) var(--val-space-4);
      margin-bottom: var(--val-space-6);
    }
    .hero h1 {
      font-size: clamp(2.5rem, 6vw, var(--val-text-5xl));
      font-weight: var(--val-weight-bold);
      line-height: var(--val-leading-tight);
      letter-spacing: -0.02em;
      margin-bottom: var(--val-space-6);
    }
    .hero h1 .accent {
      background: linear-gradient(135deg, var(--val-green-400), var(--val-green-500));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero .tagline {
      font-size: var(--val-text-xl);
      color: var(--val-color-text-muted);
      max-width: 36rem;
      margin: 0 auto var(--val-space-10);
      line-height: var(--val-leading-relaxed);
    }
    .hero-actions {
      display: flex;
      gap: var(--val-space-4);
      justify-content: center;
      flex-wrap: wrap;
    }

    /* --- Buttons --- */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: var(--val-space-2);
      padding: var(--val-space-3) var(--val-space-6);
      border-radius: var(--val-radius-md);
      font-size: var(--val-text-base);
      font-weight: var(--val-weight-medium);
      text-decoration: none;
      transition: all var(--val-duration-normal) var(--val-ease-out);
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--val-green-500), var(--val-green-400));
      color: var(--val-gray-950);
    }
    .btn-primary:hover {
      box-shadow: 0 0 20px oklch(0.7227 0.1920 149.58 / 0.3);
      transform: translateY(-1px);
    }
    .btn-secondary {
      background: var(--val-color-bg-elevated);
      color: var(--val-color-text);
      border: 1px solid var(--val-color-border);
    }
    .btn-secondary:hover {
      border-color: var(--val-gray-600);
      background: var(--val-color-bg-muted);
    }

    /* --- Port indicator --- */
    .port-indicator {
      text-align: center;
      padding: var(--val-space-4) 0;
      color: var(--val-color-text-muted);
      font-size: var(--val-text-sm);
    }
    .port-indicator code {
      background: var(--val-color-bg-elevated);
      padding: var(--val-space-1) var(--val-space-2);
      border-radius: var(--val-radius-sm);
      font-family: var(--val-font-mono);
      font-size: var(--val-text-xs);
      color: var(--val-green-400);
      border: 1px solid var(--val-color-border);
    }

    /* --- Feature cards --- */
    .features {
      padding: var(--val-space-16) 0;
      border-top: 1px solid var(--val-color-border);
    }
    .features-header {
      text-align: center;
      margin-bottom: var(--val-space-12);
    }
    .features-header h2 {
      font-size: var(--val-text-3xl);
      font-weight: var(--val-weight-bold);
      letter-spacing: -0.02em;
      margin-bottom: var(--val-space-4);
    }
    .features-header p {
      color: var(--val-color-text-muted);
      font-size: var(--val-text-lg);
      max-width: 32rem;
      margin: 0 auto;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      gap: var(--val-space-6);
    }
    .feature-card {
      background: var(--val-color-bg-elevated);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-lg);
      padding: var(--val-space-6);
      transition: border-color var(--val-duration-normal) var(--val-ease-out),
                  transform var(--val-duration-normal) var(--val-ease-out);
    }
    .feature-card:hover {
      border-color: var(--val-gray-600);
      transform: translateY(-2px);
    }
    .feature-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--val-radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: var(--val-space-4);
      font-size: var(--val-text-xl);
      background: var(--val-color-bg-muted);
    }
    .feature-card h3 {
      font-size: var(--val-text-base);
      font-weight: var(--val-weight-semibold);
      margin-bottom: var(--val-space-2);
    }
    .feature-card p {
      font-size: var(--val-text-sm);
      color: var(--val-color-text-muted);
      line-height: var(--val-leading-relaxed);
    }

    /* --- Code preview --- */
    .code-section {
      padding: var(--val-space-16) 0;
      border-top: 1px solid var(--val-color-border);
    }
    .code-section-header {
      text-align: center;
      margin-bottom: var(--val-space-10);
    }
    .code-section-header h2 {
      font-size: var(--val-text-3xl);
      font-weight: var(--val-weight-bold);
      letter-spacing: -0.02em;
      margin-bottom: var(--val-space-4);
    }
    .code-section-header p {
      color: var(--val-color-text-muted);
      font-size: var(--val-text-lg);
      max-width: 32rem;
      margin: 0 auto;
    }
    .code-block {
      background: var(--val-gray-900);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-lg);
      overflow: hidden;
      max-width: 42rem;
      margin: 0 auto;
    }
    .code-titlebar {
      display: flex;
      align-items: center;
      gap: var(--val-space-2);
      padding: var(--val-space-3) var(--val-space-4);
      background: var(--val-gray-800);
      border-bottom: 1px solid var(--val-color-border);
    }
    .code-dot {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: var(--val-radius-full);
      background: var(--val-gray-600);
    }
    .code-filename {
      font-family: var(--val-font-mono);
      font-size: var(--val-text-xs);
      color: var(--val-color-text-muted);
      margin-left: var(--val-space-2);
    }
    .code-content {
      padding: var(--val-space-5) var(--val-space-6);
      overflow-x: auto;
    }
    .code-content pre {
      font-family: var(--val-font-mono);
      font-size: var(--val-text-sm);
      line-height: 1.7;
      white-space: pre;
      color: var(--val-gray-300);
    }
    /* Syntax highlight classes */
    .hl-kw { color: oklch(0.75 0.15 300); }    /* keywords — purple */
    .hl-fn { color: var(--val-blue-400); }       /* functions */
    .hl-str { color: var(--val-green-400); }     /* strings */
    .hl-cm { color: var(--val-gray-500); }       /* comments */
    .hl-type { color: oklch(0.80 0.12 70); }     /* types/interfaces — warm */
    .hl-prop { color: var(--val-gray-200); }     /* properties */
    .hl-punct { color: var(--val-gray-500); }    /* punctuation */

    /* --- Footer --- */
    .footer {
      padding: var(--val-space-8) 0;
      border-top: 1px solid var(--val-color-border);
      text-align: center;
    }
    .footer p {
      font-size: var(--val-text-sm);
      color: var(--val-color-text-muted);
    }
    .footer a {
      color: var(--val-color-text-muted);
      text-decoration: none;
      transition: color var(--val-duration-fast);
    }
    .footer a:hover { color: var(--val-color-text); }

    /* --- Responsive --- */
    @media (max-width: 640px) {
      .hero { padding: var(--val-space-16) 0 var(--val-space-10); }
      .hero h1 { font-size: 2rem; }
      .hero .tagline { font-size: var(--val-text-base); }
      .hero-actions { flex-direction: column; align-items: center; }
      .btn { width: 100%; max-width: 20rem; justify-content: center; }
      .features-grid { grid-template-columns: 1fr; }
      .code-content { padding: var(--val-space-4); }
      .code-content pre { font-size: var(--val-text-xs); }
      .nav-links { gap: var(--val-space-3); }
    }

    /* --- Scroll animation --- */
    .fade-in {
      opacity: 0;
      transform: translateY(1.5rem);
      transition: opacity var(--val-duration-slow) var(--val-ease-out),
                  transform var(--val-duration-slow) var(--val-ease-out);
    }
    .fade-in.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* --- Focus visible for keyboard nav --- */
    a:focus-visible, .btn:focus-visible {
      outline: 2px solid var(--val-blue-400);
      outline-offset: 2px;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Nav -->
    <nav class="nav" aria-label="Main navigation">
      <a href="/" class="nav-brand"><span>v</span>alence</a>
      <div class="nav-links">
        <a href="/admin" class="nav-link">Admin</a>
        <a href="/_learn" class="nav-link">Learn</a>
        <a href="https://github.com/valencets/valence" class="nav-link" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </nav>

    <!-- Hero -->
    <section class="hero">
      <div class="hero-badge">Running on port ${port}</div>
      <h1>One config.<br><span class="accent">Everything generated.</span></h1>
      <p class="tagline">
        Define your schema in TypeScript. Valence generates your database tables,
        admin UI, REST API, and typed frontend scaffold.
      </p>
      <div class="hero-actions">
        <a href="/admin" class="btn btn-primary">Open Admin Panel</a>
        <a href="/_learn" class="btn btn-secondary">Learn Valence</a>
      </div>
    </section>

    <!-- Port status -->
    <div class="port-indicator">
      Dev server ready at <code>http://localhost:${port}</code>
    </div>

    <!-- Features -->
    <section class="features fade-in" aria-label="Key features">
      <div class="features-header">
        <h2>Built for developers</h2>
        <p>Everything you need to build content-driven applications, without the boilerplate.</p>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">{}</div>
          <h3>Schema-driven</h3>
          <p>One <code>valence.config.ts</code> generates database tables, admin views, REST endpoints, and Zod validators automatically.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">TS</div>
          <h3>Type-safe end-to-end</h3>
          <p>TypeScript from config to frontend. Strict null checks, exact optional properties, and generated types for every collection.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">&lt;/&gt;</div>
          <h3>Server-rendered admin</h3>
          <p>No React, no client framework. The admin panel is plain HTML with minimal JavaScript. Fast to load, easy to customize.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">PG</div>
          <h3>Real PostgreSQL</h3>
          <p>Not SQLite. Full-text search with tsvector, advisory locks for migrations, and proper transaction support out of the box.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">+</div>
          <h3>Plugin system</h3>
          <p>Extend with first-party plugins for SEO metadata, nested documents, S3 cloud storage, and GraphQL schema generation.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon" aria-hidden="true">/</div>
          <h3>REST API</h3>
          <p>Every collection gets paginated REST endpoints with authentication, filtering, search, and field-level access control.</p>
        </div>
      </div>
    </section>

    <!-- Code preview -->
    <section class="code-section fade-in" aria-label="Code example">
      <div class="code-section-header">
        <h2>Minimal config, maximum output</h2>
        <p>This is all you need to get a fully functional CMS with typed API endpoints.</p>
      </div>
      <div class="code-block">
        <div class="code-titlebar">
          <div class="code-dot"></div>
          <div class="code-dot"></div>
          <div class="code-dot"></div>
          <span class="code-filename">valence.config.ts</span>
        </div>
        <div class="code-content">
          <pre><span class="hl-kw">import</span> <span class="hl-punct">{</span> <span class="hl-fn">defineConfig</span><span class="hl-punct">,</span> <span class="hl-fn">collection</span><span class="hl-punct">,</span> <span class="hl-prop">field</span> <span class="hl-punct">}</span> <span class="hl-kw">from</span> <span class="hl-str">'valence'</span>

<span class="hl-kw">export default</span> <span class="hl-fn">defineConfig</span><span class="hl-punct">({</span>
  <span class="hl-prop">collections</span><span class="hl-punct">:</span> <span class="hl-punct">[</span>
    <span class="hl-fn">collection</span><span class="hl-punct">({</span>
      <span class="hl-prop">slug</span><span class="hl-punct">:</span> <span class="hl-str">'posts'</span><span class="hl-punct">,</span>
      <span class="hl-prop">fields</span><span class="hl-punct">:</span> <span class="hl-punct">[</span>
        <span class="hl-prop">field</span><span class="hl-punct">.</span><span class="hl-fn">text</span><span class="hl-punct">({</span> <span class="hl-prop">name</span><span class="hl-punct">:</span> <span class="hl-str">'title'</span><span class="hl-punct">,</span> <span class="hl-prop">required</span><span class="hl-punct">:</span> <span class="hl-kw">true</span> <span class="hl-punct">}),</span>
        <span class="hl-prop">field</span><span class="hl-punct">.</span><span class="hl-fn">richText</span><span class="hl-punct">({</span> <span class="hl-prop">name</span><span class="hl-punct">:</span> <span class="hl-str">'content'</span> <span class="hl-punct">}),</span>
        <span class="hl-prop">field</span><span class="hl-punct">.</span><span class="hl-fn">select</span><span class="hl-punct">({</span>
          <span class="hl-prop">name</span><span class="hl-punct">:</span> <span class="hl-str">'status'</span><span class="hl-punct">,</span>
          <span class="hl-prop">options</span><span class="hl-punct">:</span> <span class="hl-punct">[</span><span class="hl-str">'draft'</span><span class="hl-punct">,</span> <span class="hl-str">'published'</span><span class="hl-punct">]</span>
        <span class="hl-punct">})</span>
      <span class="hl-punct">]</span>
    <span class="hl-punct">})</span>
  <span class="hl-punct">]</span>
<span class="hl-punct">})</span></pre>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
      <p>
        Valence &middot; Schema-driven CMS framework &middot;
        <a href="https://github.com/valencets/valence" target="_blank" rel="noopener noreferrer">Source</a>
      </p>
    </footer>
  </div>

  <script>
    // Scroll-triggered fade-in for feature and code sections
    (function () {
      var targets = document.querySelectorAll('.fade-in')
      if (!('IntersectionObserver' in window)) {
        for (var i = 0; i < targets.length; i++) targets[i].classList.add('visible')
        return
      }
      var observer = new IntersectionObserver(function (entries) {
        for (var j = 0; j < entries.length; j++) {
          if (entries[j].isIntersecting) {
            entries[j].target.classList.add('visible')
            observer.unobserve(entries[j].target)
          }
        }
      }, { threshold: 0.15 })
      for (var k = 0; k < targets.length; k++) observer.observe(targets[k])
    })()
  </script>
</body>
</html>`
}
