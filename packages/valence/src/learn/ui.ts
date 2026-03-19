import type { LearnProgress, LearnStepId } from './types.js'

interface StepDisplay {
  readonly id: LearnStepId
  readonly number: number
  readonly title: string
  readonly description: string
  readonly hint: string
  readonly command: string
}

const STEPS: ReadonlyArray<StepDisplay> = [
  {
    id: 'visit-admin',
    number: 1,
    title: 'Visit the Admin Panel',
    description: 'The admin panel is where you manage your content. Valence generates it automatically from your collections schema.',
    hint: 'Click the link below or navigate to the admin URL in your browser.',
    command: '/admin'
  },
  {
    id: 'create-post',
    number: 2,
    title: 'Create a Post',
    description: 'Collections define your data model. The "posts" collection was created by <code>valence init</code>. Create a new post using the admin panel.',
    hint: 'Go to the admin panel, click "Posts", then "Create New".',
    command: ''
  },
  {
    id: 'hit-api',
    number: 3,
    title: 'Hit the REST API',
    description: 'Every collection automatically gets a REST API. Try fetching your posts from the command line or browser.',
    hint: 'Run this command in your terminal:',
    command: 'curl http://localhost:PORT/api/posts'
  },
  {
    id: 'add-collection',
    number: 4,
    title: 'Add a New Collection',
    description: 'Collections are defined in <code>valence.config.ts</code>. Valence watches this file and detects changes automatically &mdash; no restart needed.',
    hint: 'Open <code>valence.config.ts</code> and uncomment the <code>tags</code> collection at the bottom, then save.',
    command: ''
  },
  {
    id: 'create-user',
    number: 5,
    title: 'Create an Admin User',
    description: 'Users with auth enabled get password hashing and session management. Create a user via the CLI.',
    hint: 'Run this command in a new terminal:',
    command: 'npx valence user:create'
  },
  {
    id: 'create-file',
    number: 6,
    title: 'Create a Custom TypeScript File',
    description: 'Valence projects are just TypeScript. Create any <code>.ts</code> file in your project root to prove it.',
    hint: 'Create a file like <code>hello.ts</code> in your project root:',
    command: 'echo \'console.log("Hello from Valence!")\' > hello.ts'
  }
]

export function renderLearnPage (progress: LearnProgress, port: number): string {
  const completedCount = Object.values(progress.steps).filter(s => s.completed).length
  const allComplete = completedCount === 6
  const progressPct = Math.round((completedCount / 6) * 100)

  // Find first incomplete step
  const currentStepId = STEPS.find(s => !progress.steps[s.id].completed)?.id ?? null

  const stepsHtml = STEPS.map(step => {
    const state = progress.steps[step.id]
    const isCurrent = step.id === currentStepId
    const command = step.command.replace('PORT', String(port))

    if (state.completed) {
      return `
      <div class="step completed">
        <div class="step-header">
          <span class="step-check">&#10003;</span>
          <span class="step-number">${step.number}.</span>
          <span class="step-title">${step.title}</span>
        </div>
      </div>`
    }

    if (isCurrent) {
      return `
      <div class="step current" id="step-${step.id}">
        <div class="step-header">
          <span class="step-dot">&#9679;</span>
          <span class="step-number">${step.number}.</span>
          <span class="step-title">${step.title}</span>
        </div>
        <div class="step-body">
          <p>${step.description}</p>
          <p class="hint">${step.hint}</p>
          ${command
? `<div class="command-block">
            <code>${escapeHtml(command)}</code>
            <button class="copy-btn" onclick="copyToClipboard('${escapeJs(command)}', this)">Copy</button>
          </div>`
: ''}
          ${step.id === 'visit-admin' ? '<a href="/admin" class="action-link" target="_blank">Open Admin Panel &rarr;</a>' : ''}
        </div>
      </div>`
    }

    return `
      <div class="step future">
        <div class="step-header">
          <span class="step-dot dim">&#9675;</span>
          <span class="step-number">${step.number}.</span>
          <span class="step-title">${step.title}</span>
        </div>
      </div>`
  }).join('\n')

  const celebrationHtml = allComplete
    ? `
    <div class="celebration">
      <h2>Tutorial complete!</h2>
      <p>You've learned the core concepts of Valence. Here's what to explore next:</p>
      <div class="next-links">
        <a href="/admin">Admin Panel</a>
        <a href="/admin/analytics">Analytics Dashboard</a>
        <a href="https://github.com/valencets/valence/wiki">Documentation</a>
      </div>
      <p style="margin-top:1rem;font-size:0.85rem;color:#64748b">Valence includes built-in first-party analytics &mdash; no third-party scripts. Add <code>data-telemetry-*</code> attributes to your HTML to track user intent, and view the results at <code>/admin/analytics</code>.</p>
    </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Valence Learn</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 640px; margin: 0 auto; }
    header { margin-bottom: 2rem; }
    h1 {
      font-size: 1.75rem;
      font-weight: 300;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    h1 span { font-weight: 600; color: #3b82f6; }
    .progress-bar-container {
      background: #1e293b;
      border-radius: 8px;
      height: 8px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }
    .progress-bar-fill {
      background: #3b82f6;
      height: 100%;
      border-radius: 8px;
      transition: width 0.4s ease;
    }
    .progress-text { color: #94a3b8; font-size: 0.85rem; }
    .steps { display: flex; flex-direction: column; gap: 0.5rem; }
    .step {
      background: #1e293b;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      border-left: 3px solid transparent;
    }
    .step.completed { border-left-color: #22c55e; opacity: 0.7; }
    .step.current { border-left-color: #3b82f6; }
    .step.future { opacity: 0.4; }
    .step-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    .step-check { color: #22c55e; font-size: 1.1rem; }
    .step-dot { color: #3b82f6; font-size: 0.75rem; }
    .step-dot.dim { color: #475569; }
    .step-number { color: #64748b; font-size: 0.85rem; }
    .step-title { font-weight: 500; }
    .step-body { margin-top: 0.75rem; padding-left: 1.75rem; }
    .step-body p { color: #94a3b8; line-height: 1.6; margin-bottom: 0.5rem; font-size: 0.9rem; }
    .step-body code { background: #0f172a; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.85rem; color: #e2e8f0; }
    .hint { color: #64748b !important; font-style: italic; }
    .command-block {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      margin-top: 0.5rem;
    }
    .command-block code {
      flex: 1;
      background: transparent;
      padding: 0;
      font-size: 0.85rem;
      color: #e2e8f0;
    }
    .copy-btn {
      background: #334155;
      color: #94a3b8;
      border: none;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8rem;
      transition: background 0.15s;
    }
    .copy-btn:hover { background: #475569; color: #e2e8f0; }
    .action-link {
      display: inline-block;
      margin-top: 0.75rem;
      color: #3b82f6;
      text-decoration: none;
      font-size: 0.9rem;
      padding: 0.4rem 0.75rem;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      transition: all 0.15s;
    }
    .action-link:hover { background: #3b82f6; color: #0f172a; }
    .celebration {
      background: #1e293b;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      margin-top: 1.5rem;
      border: 1px solid #22c55e;
    }
    .celebration h2 { color: #22c55e; margin-bottom: 0.5rem; font-size: 1.25rem; }
    .celebration p { color: #94a3b8; margin-bottom: 1rem; font-size: 0.9rem; }
    .next-links { display: flex; gap: 0.75rem; justify-content: center; }
    .next-links a {
      color: #3b82f6;
      text-decoration: none;
      padding: 0.4rem 0.75rem;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      transition: all 0.15s;
      font-size: 0.9rem;
    }
    .next-links a:hover { background: #3b82f6; color: #0f172a; }
    footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #1e293b;
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    footer a {
      color: #64748b;
      text-decoration: none;
      font-size: 0.8rem;
      transition: color 0.15s;
    }
    footer a:hover { color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>v</span>alence <span style="font-weight:300;color:#64748b">learn</span></h1>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
      </div>
      <p class="progress-text">${completedCount} of 6 steps complete</p>
    </header>

    <div class="steps">
      ${stepsHtml}
    </div>

    ${celebrationHtml}

    <footer>
      <a href="/admin">Admin Panel</a>
      <a href="/admin/analytics">Analytics</a>
      <a href="http://localhost:${port}/api/posts">REST API</a>
      <a href="https://github.com/valencets/valence/wiki">Documentation</a>
      <a href="/_splash">Exit Learn Mode</a>
    </footer>
  </div>

  <script>
    function copyToClipboard(text, btn) {
      navigator.clipboard.writeText(text).then(function() {
        var orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(function() { btn.textContent = orig; }, 1500);
      });
    }

    (function poll() {
      fetch('/_learn/api/progress')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var completed = 0;
          var stepIds = ['visit-admin','create-post','hit-api','add-collection','create-user','create-file'];
          for (var i = 0; i < stepIds.length; i++) {
            if (data.steps[stepIds[i]] && data.steps[stepIds[i]].completed) completed++;
          }
          var currentCompleted = ${completedCount};
          if (completed !== currentCompleted) {
            window.location.reload();
          }
        })
        .catch(function() {});
      setTimeout(poll, 5000);
    })();
  </script>
</body>
</html>`
}

function escapeHtml (str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeJs (str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
}
