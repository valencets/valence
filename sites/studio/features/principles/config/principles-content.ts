export const PRINCIPLES = [
  {
    id: 'av-206',
    title: 'AV Rule 206 — No Dynamic Memory Allocation',
    origin: 'From the Joint Strike Fighter C++ Coding Standards. Fighter jet software cannot afford a garbage collector pausing mid-flight. Neither should your website.',
    explanation: 'Every telemetry object is pre-allocated at boot into a fixed-capacity ring buffer. When a visitor clicks, we reuse a slot — no allocation, no GC pause. The buffer is a fixed size, determined at initialization. It never grows.',
    benefit: 'Your visitors get deterministic performance. No jank. No mystery slowdowns. Every interaction responds in the same timeframe, every time.'
  },
  {
    id: 'av-208',
    title: 'AV Rule 208 — No Exceptions',
    origin: 'Exceptions create invisible control flow. In safety-critical systems, every code path must be visible and accounted for. We apply the same discipline.',
    explanation: 'Instead of try/catch, every function returns an explicit Result — either an Ok with the expected value, or an Err with a typed error. There is exactly one boundary where we catch: parsing incoming JSON from external sources.',
    benefit: 'No silent failures. No error swallowing. When something goes wrong, the code tells you exactly what and where, without unwinding a call stack.'
  },
  {
    id: 'av-3',
    title: 'AV Rule 3 — Cyclomatic Complexity < 20',
    origin: 'Complex functions hide bugs. The aerospace standard caps function complexity to ensure every path can be tested and verified.',
    explanation: 'Every function stays under 20 cyclomatic complexity. We use early returns, static dictionary maps, and micro-components. No switch statements — lookup tables are more predictable and testable.',
    benefit: 'The code that runs your website is auditable. Every function is small enough to reason about. Bugs have fewer places to hide.'
  },
  {
    id: '14kb',
    title: '14kB Protocol Limit',
    origin: 'TCP slow start delivers roughly 10 packets (~14kB) before waiting for acknowledgment. If your critical shell fits in that window, the browser can start rendering before the server even confirms the connection.',
    explanation: 'We inline critical CSS directly into the HTML document. No external stylesheet blocking render. The full CSS loads asynchronously after first paint. The result: your website renders from the very first server response.',
    benefit: 'First Contentful Paint on the first TCP round trip. On a Pi 5 behind Cloudflare, that means sub-100ms perceived load times even on mobile connections.'
  }
] as const
