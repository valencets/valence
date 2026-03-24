// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { Bench } from 'tinybench'
import { signal, computed, effect, batch } from '../core.js'

function getOpsPerSec (bench: Bench): number {
  const task = bench.tasks[0]!
  const tp = task.result!.throughput
  if (typeof tp === 'number') return tp
  if (typeof tp === 'object' && tp !== null && 'mean' in tp) return (tp as { mean: number }).mean
  return task.result!.latency
    ? 1_000 / (task.result!.latency as { mean: number }).mean
    : 0
}

describe('benchmarks', { timeout: 30_000 }, () => {
  it('signal write+read: >1M ops/sec', async () => {
    const bench = new Bench({ iterations: 3 })
    const s = signal(0)
    bench.add('signal write+read', () => {
      s.value = s.peek() + 1
    })
    await bench.run()
    const ops = getOpsPerSec(bench)
    console.log(`signal write+read: ${Math.round(ops).toLocaleString()} ops/sec`)
    expect(ops).toBeGreaterThan(1_000_000)
  })

  it('computed read (cached): >1M ops/sec', async () => {
    const bench = new Bench({ iterations: 3 })
    const s = signal(1)
    const c = computed(() => s.value * 2)
    expect(c.value).toBe(2)
    const _sink = { v: 0 }
    bench.add('computed read', () => { _sink.v = c.value })
    await bench.run()
    const ops = getOpsPerSec(bench)
    console.log(`computed read (cached): ${Math.round(ops).toLocaleString()} ops/sec`)
    expect(ops).toBeGreaterThan(1_000_000)
  })

  it('signal → computed → effect propagation: >100k ops/sec', async () => {
    const bench = new Bench({ iterations: 3 })
    const s = signal(0)
    const c = computed(() => s.value * 2)
    const _sink = { v: 0 }
    const dispose = effect(() => { _sink.v = c.value })
    bench.add('propagate', () => { s.value = s.peek() + 1 })
    await bench.run()
    dispose()
    const ops = getOpsPerSec(bench)
    console.log(`propagate (s→c→e): ${Math.round(ops).toLocaleString()} ops/sec`)
    expect(ops).toBeGreaterThan(100_000)
  })

  it('batch 10 writes → 1 effect: >100k ops/sec', async () => {
    const bench = new Bench({ iterations: 3 })
    const sigs = Array.from({ length: 10 }, (_, i) => signal(i))
    const sum = computed(() => sigs.reduce((a, s) => a + s.value, 0))
    const _sink = { v: 0 }
    const dispose = effect(() => { _sink.v = sum.value })
    bench.add('batch 10', () => {
      batch(() => { for (let i = 0; i < 10; i++) sigs[i]!.value = sigs[i]!.peek() + 1 })
    })
    await bench.run()
    dispose()
    const ops = getOpsPerSec(bench)
    console.log(`batch 10 writes: ${Math.round(ops).toLocaleString()} ops/sec`)
    expect(ops).toBeGreaterThan(100_000)
  })

  it('100 computeds fan-out: >10k ops/sec', async () => {
    const bench = new Bench({ iterations: 3 })
    const root = signal(0)
    const cs = Array.from({ length: 100 }, (_, i) => computed(() => root.value + i))
    const _sink = { v: 0 }
    const dispose = effect(() => { _sink.v = cs.reduce((a, c) => a + c.value, 0) })
    bench.add('fan-out', () => { root.value = root.peek() + 1 })
    await bench.run()
    dispose()
    const ops = getOpsPerSec(bench)
    console.log(`100 computeds fan-out: ${Math.round(ops).toLocaleString()} ops/sec`)
    expect(ops).toBeGreaterThan(10_000)
  })
})
