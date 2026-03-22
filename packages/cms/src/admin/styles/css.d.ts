// TypeScript declaration for CSS file imports (esbuild --loader:.css=text).
// esbuild text loader emits default exports — this declaration describes
// external tool behavior, not a Valence code convention. The "no export default"
// rule applies to our own TypeScript modules, not build tool declarations.
declare module '*.css' {
  const content: string
  export default content
}
