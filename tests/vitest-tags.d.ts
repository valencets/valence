declare module 'vitest' {
  interface TestTagMap {
    smoke: true
    regression: true
    unit: true
    flaky: true
  }
}

export {}
