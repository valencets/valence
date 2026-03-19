export function generateHomePage (): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Home</title>
  <link rel="stylesheet" href="/src/app/styles.css">
  <style>
    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
      text-align: center;
      padding: var(--val-space-8);
    }
    .hero h1 {
      font-size: var(--val-text-4xl);
      font-weight: var(--val-weight-bold);
      letter-spacing: -0.02em;
      margin-bottom: var(--val-space-4);
    }
    .hero p {
      color: var(--val-color-text-muted);
      font-size: var(--val-text-lg);
      max-width: 40ch;
      line-height: var(--val-leading-relaxed);
      margin-bottom: var(--val-space-8);
    }
    .hero-links {
      display: flex;
      gap: var(--val-space-4);
    }
    .hero-links a {
      padding: var(--val-space-2) var(--val-space-6);
      border-radius: var(--val-radius-md);
      font-size: var(--val-text-sm);
      font-weight: var(--val-weight-medium);
      text-decoration: none;
      transition: background var(--val-duration-fast), color var(--val-duration-fast);
    }
    .btn-primary {
      background: var(--val-color-primary);
      color: var(--val-color-bg);
    }
    .btn-primary:hover {
      background: var(--val-color-primary-hover);
    }
    .btn-outline {
      border: 1px solid var(--val-color-border);
      color: var(--val-color-text);
    }
    .btn-outline:hover {
      border-color: var(--val-color-primary);
      color: var(--val-color-primary);
    }
    .posts {
      max-width: 640px;
      margin: 0 auto;
      padding: 0 var(--val-space-4) var(--val-space-8);
    }
    .posts h2 {
      font-size: var(--val-text-xl);
      font-weight: var(--val-weight-semibold);
      margin-bottom: var(--val-space-4);
    }
    .post-card {
      padding: var(--val-space-4);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-lg);
      margin-bottom: var(--val-space-3);
      transition: border-color var(--val-duration-fast);
    }
    .post-card:hover {
      border-color: var(--val-color-primary);
    }
    .post-card h3 {
      font-size: var(--val-text-base);
      font-weight: var(--val-weight-medium);
      margin-bottom: var(--val-space-1);
    }
    .post-card time {
      font-size: var(--val-text-xs);
      color: var(--val-color-text-muted);
    }
    #posts-list { list-style: none; }
  </style>
</head>
<body>
  <section class="hero">
    <h1>Your Valence Site</h1>
    <p>Edit this page at <code>src/pages/home/ui/index.html</code> or manage content in the admin panel.</p>
    <div class="hero-links">
      <a href="/admin" class="btn-primary">Admin Panel</a>
      <a href="/api/posts" class="btn-outline">API</a>
    </div>
  </section>

  <section class="posts">
    <h2>Recent Posts</h2>
    <ul id="posts-list"></ul>
  </section>

  <script type="module">
    const res = await fetch('/api/posts')
    if (res.ok) {
      const posts = await res.json()
      const list = document.getElementById('posts-list')
      for (const post of posts) {
        const li = document.createElement('li')
        li.className = 'post-card'
        const h3 = document.createElement('h3')
        h3.textContent = post.title ?? ''
        const time = document.createElement('time')
        time.textContent = post.publishedAt ?? ''
        li.appendChild(h3)
        li.appendChild(time)
        list.appendChild(li)
      }
    }
  </script>
</body>
</html>
`
}
