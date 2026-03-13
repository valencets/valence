import postcss from 'postcss'
import type { Root, ChildNode, Rule, AtRule } from 'postcss'
import { err, fromThrowable } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'
import { CriticalCSSErrorCode } from './types.js'
import type { CriticalCSSError, ExtractedSelectors, SplitResult } from './types.js'

// fromThrowable boundary for postcss.parse() — same pattern as safeJsonParse
const safeParse = fromThrowable(
  (css: string) => postcss.parse(css),
  (e: unknown): CriticalCSSError => ({
    code: CriticalCSSErrorCode.CSS_PARSE_FAILED,
    message: e instanceof Error ? e.message : 'Unknown CSS parse error'
  })
)

// Regex to extract class names from CSS selectors (e.g. ".bg-primary" → "bg-primary")
const CSS_CLASS_RE = /\.([a-zA-Z_-][\w-]*(?:\[[^\]]*\])?)/g

// Regex to extract IDs from CSS selectors (e.g. "#hero" → "hero")
const CSS_ID_RE = /#([a-zA-Z_-][\w-]*)/g

// Regex to extract bare element names from CSS selectors
const CSS_ELEMENT_RE = /(?:^|[\s,>+~])([a-zA-Z][\w-]*)/g

// Always-critical selectors
const ALWAYS_CRITICAL_SELECTORS = new Set([':root', 'body'])

// Classifier for always-critical at-rule names (dictionary map, no switch)
const ALWAYS_CRITICAL_AT_RULES: Record<string, (node: AtRule) => boolean> = {
  'custom-variant': () => true,
  theme: () => true,
  layer: (node) => node.params.startsWith('base')
}

function isSelectorAlwaysCritical (selector: string): boolean {
  // Check for :root, body, .dark at top level
  const parts = selector.split(',')
  for (const part of parts) {
    const trimmed = part.trim()
    if (ALWAYS_CRITICAL_SELECTORS.has(trimmed)) return true
    if (trimmed === '.dark' || trimmed.startsWith('.dark ')) return true
  }
  return false
}

function doesSelectorMatch (selector: string, selectors: ExtractedSelectors): boolean {
  // Check class matches — reset lastIndex for global regex reuse
  CSS_CLASS_RE.lastIndex = 0
  let match = CSS_CLASS_RE.exec(selector)
  while (match !== null) {
    const className = match[1]
    if (className !== undefined && selectors.classNames.has(className)) return true
    match = CSS_CLASS_RE.exec(selector)
  }

  // Check ID matches
  CSS_ID_RE.lastIndex = 0
  match = CSS_ID_RE.exec(selector)
  while (match !== null) {
    const id = match[1]
    if (id !== undefined && selectors.ids.has(id)) return true
    match = CSS_ID_RE.exec(selector)
  }

  // Check element matches
  CSS_ELEMENT_RE.lastIndex = 0
  match = CSS_ELEMENT_RE.exec(selector)
  while (match !== null) {
    const element = match[1]
    if (element !== undefined && selectors.elements.has(element.toLowerCase())) return true
    match = CSS_ELEMENT_RE.exec(selector)
  }

  return false
}

function isRuleCritical (node: Rule, selectors: ExtractedSelectors): boolean {
  if (isSelectorAlwaysCritical(node.selector)) return true
  return doesSelectorMatch(node.selector, selectors)
}

function isAtRuleCritical (node: AtRule, selectors: ExtractedSelectors): boolean {
  // Check always-critical at-rules via dictionary map
  const classifier = ALWAYS_CRITICAL_AT_RULES[node.name]
  if (classifier !== undefined && classifier(node)) return true

  // For @media and other container at-rules, check if any child is critical
  if (node.nodes !== undefined) {
    for (const child of node.nodes) {
      if (child.type === 'rule' && isRuleCritical(child as Rule, selectors)) return true
      if (child.type === 'atrule' && isAtRuleCritical(child as AtRule, selectors)) return true
    }
  }

  return false
}

// Node classifier — dictionary map (no switch)
const NODE_CLASSIFIERS: Record<string, (node: ChildNode, selectors: ExtractedSelectors) => boolean> = {
  rule: (node, selectors) => isRuleCritical(node as Rule, selectors),
  atrule: (node, selectors) => isAtRuleCritical(node as AtRule, selectors)
}

function classifyNode (node: ChildNode, selectors: ExtractedSelectors): boolean {
  const classifier = NODE_CLASSIFIERS[node.type]
  if (classifier !== undefined) return classifier(node, selectors)
  // Comments and other nodes: always critical (preserve structure)
  return true
}

function buildOutput (root: Root, selectors: ExtractedSelectors): SplitResult {
  const criticalRoot = postcss.root()
  const deferredRoot = postcss.root()

  for (const node of root.nodes) {
    if (classifyNode(node, selectors)) {
      criticalRoot.append(node.clone())
    } else {
      deferredRoot.append(node.clone())
    }
  }

  const critical = criticalRoot.nodes.length > 0 ? criticalRoot.toString() : ''
  const deferred = deferredRoot.nodes.length > 0 ? deferredRoot.toString() : ''

  return { critical, deferred }
}

export function splitCSS (
  fullCSS: string,
  selectors: ExtractedSelectors
): Result<SplitResult, CriticalCSSError> {
  if (fullCSS.trim().length === 0) {
    return err({
      code: CriticalCSSErrorCode.EMPTY_CSS,
      message: 'CSS input is empty'
    })
  }

  return safeParse(fullCSS)
    .map((root) => buildOutput(root, selectors))
}
