import type { LearnProgress, LearnStepId } from './types.js'
import { PAGE_TOKEN_CSS } from '../page-tokens.js'

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
      <p style="margin-top:var(--val-space-4);font-size:var(--val-text-sm);color:var(--val-gray-500)">Valence includes built-in first-party analytics &mdash; no third-party scripts. Add <code>data-telemetry-*</code> attributes to your HTML to track user intent, and view the results at <code>/admin/analytics</code>.</p>
    </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Valence Learn</title>
  <style>
    ${PAGE_TOKEN_CSS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--val-font-sans);
      background: var(--val-color-bg);
      color: var(--val-color-text);
      min-height: 100vh;
      padding: var(--val-space-8);
    }
    .container { max-width: 640px; margin: 0 auto; }
    header { margin-bottom: var(--val-space-8); }
    h1 {
      font-size: var(--val-text-2xl);
      font-weight: 300;
      letter-spacing: 0.05em;
      margin-bottom: var(--val-space-4);
    }
    h1 span { font-weight: 600; color: var(--val-color-primary); }
    .progress-bar-container {
      background: var(--val-color-bg-elevated);
      border-radius: var(--val-radius-lg);
      height: 8px;
      overflow: hidden;
      margin-bottom: var(--val-space-2);
    }
    .progress-bar-fill {
      background: var(--val-color-primary);
      height: 100%;
      border-radius: var(--val-radius-lg);
      transition: width 0.4s ease;
    }
    .progress-text { color: var(--val-color-text-muted); font-size: var(--val-text-sm); }
    .steps { display: flex; flex-direction: column; gap: var(--val-space-2); }
    .step {
      background: var(--val-color-bg-elevated);
      border-radius: var(--val-radius-lg);
      padding: var(--val-space-4) var(--val-space-5);
      border-left: 3px solid transparent;
    }
    .step.completed { border-left-color: var(--val-color-success); opacity: 0.7; }
    .step.current { border-left-color: var(--val-color-primary); }
    .step.future { opacity: 0.4; }
    .step-header {
      display: flex;
      align-items: center;
      gap: var(--val-space-2);
      cursor: pointer;
    }
    .step-check { color: var(--val-color-success); font-size: var(--val-text-lg); }
    .step-dot { color: var(--val-color-primary); font-size: var(--val-text-xs); }
    .step-dot.dim { color: var(--val-gray-600); }
    .step-number { color: var(--val-gray-500); font-size: var(--val-text-sm); }
    .step-title { font-weight: 500; }
    .step-body { margin-top: var(--val-space-3); padding-left: var(--val-space-6); }
    .step-body p { color: var(--val-color-text-muted); line-height: 1.6; margin-bottom: var(--val-space-2); font-size: var(--val-text-sm); }
    .step-body code { background: var(--val-gray-900); padding: var(--val-space-1) var(--val-space-2); border-radius: var(--val-radius-sm); font-size: var(--val-text-sm); color: var(--val-color-text); }
    .hint { color: var(--val-gray-500) !important; font-style: italic; }
    .command-block {
      display: flex;
      align-items: center;
      gap: var(--val-space-3);
      background: var(--val-gray-900);
      border: 1px solid var(--val-color-border);
      border-radius: var(--val-radius-md);
      padding: var(--val-space-2) var(--val-space-3);
      margin-top: var(--val-space-2);
    }
    .command-block code {
      flex: 1;
      background: transparent;
      padding: 0;
      font-size: var(--val-text-sm);
      color: var(--val-color-text);
    }
    .copy-btn {
      background: var(--val-color-border);
      color: var(--val-color-text-muted);
      border: none;
      padding: var(--val-space-1) var(--val-space-3);
      border-radius: var(--val-radius-sm);
      cursor: pointer;
      font-size: var(--val-text-xs);
      transition: background var(--val-duration-fast);
    }
    .copy-btn:hover { background: var(--val-gray-600); color: var(--val-color-text); }
    .action-link {
      display: inline-block;
      margin-top: var(--val-space-3);
      color: var(--val-color-primary);
      text-decoration: none;
      font-size: var(--val-text-sm);
      padding: var(--val-space-2) var(--val-space-3);
      border: 1px solid var(--val-color-primary);
      border-radius: var(--val-radius-md);
      transition: all var(--val-duration-fast);
    }
    .action-link:hover { background: var(--val-color-primary); color: var(--val-color-bg); }
    .celebration {
      background: var(--val-color-bg-elevated);
      border-radius: var(--val-radius-lg);
      padding: var(--val-space-6);
      text-align: center;
      margin-top: var(--val-space-6);
      border: 1px solid var(--val-color-success);
    }
    .celebration h2 { color: var(--val-color-success); margin-bottom: var(--val-space-2); font-size: var(--val-text-xl); }
    .celebration p { color: var(--val-color-text-muted); margin-bottom: var(--val-space-4); font-size: var(--val-text-sm); }
    .next-links { display: flex; gap: var(--val-space-3); justify-content: center; }
    .next-links a {
      color: var(--val-color-primary);
      text-decoration: none;
      padding: var(--val-space-2) var(--val-space-3);
      border: 1px solid var(--val-color-primary);
      border-radius: var(--val-radius-md);
      transition: all var(--val-duration-fast);
      font-size: var(--val-text-sm);
    }
    .next-links a:hover { background: var(--val-color-primary); color: var(--val-color-bg); }
    footer {
      margin-top: var(--val-space-8);
      padding-top: var(--val-space-4);
      border-top: 1px solid var(--val-color-bg-elevated);
      display: flex;
      gap: var(--val-space-4);
      justify-content: center;
      flex-wrap: wrap;
    }
    footer a {
      color: var(--val-gray-500);
      text-decoration: none;
      font-size: var(--val-text-xs);
      transition: color var(--val-duration-fast);
    }
    footer a:hover { color: var(--val-color-text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>v</span>alence <span style="font-weight:300;color:var(--val-gray-500)">learn</span></h1>
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
