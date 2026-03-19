import { describe, it, expect } from 'vitest'
import { TelemetryRingBuffer } from '../ring-buffer.js'
import { IntentType } from '../intent-types.js'

describe('TelemetryRingBuffer', () => {
  describe('create', () => {
    it('succeeds with valid power-of-two capacity', () => {
      const result = TelemetryRingBuffer.create(16)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.capacity).toBe(16)
      }
    })

    it('fails with invalid capacity', () => {
      const result = TelemetryRingBuffer.create(7)
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_CAPACITY')
      }
    })

    it('starts empty', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        expect(buf.head).toBe(0)
        expect(buf.tail).toBe(0)
        expect(buf.count).toBe(0)
        expect(buf.isFull).toBe(false)
      }
    })

    it('all slots initialized isDirty=false', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        for (let i = 0; i < 8; i++) {
          const slot = buf.slotAt(i)!
          expect(slot.isDirty).toBe(false)
          expect(slot.site_id).toBe('')
        }
      }
    })

    it('slots have monotonic IDs', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        for (let i = 0; i < 4; i++) {
          expect(buf.slotAt(i)!.id).toBe(`slot-${i}`)
        }
      }
    })
  })

  describe('write', () => {
    it('sets correct properties on slot', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        const writeResult = buf.write(IntentType.CLICK, 'button.cta', 100, 200, 1000)
        expect(writeResult.isOk()).toBe(true)
        if (writeResult.isOk()) {
          const slot = writeResult.value
          expect(slot.type).toBe(IntentType.CLICK)
          expect(slot.targetDOMNode).toBe('button.cta')
          expect(slot.x_coord).toBe(100)
          expect(slot.y_coord).toBe(200)
          expect(slot.timestamp).toBe(1000)
          expect(slot.isDirty).toBe(true)
        }
      }
    })

    it('advances head after write', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        expect(buf.head).toBe(0)
        buf.write(IntentType.CLICK, 'a', 0, 0, 1)
        expect(buf.head).toBe(1)
      }
    })

    it('sets isDirty to true', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.SCROLL, 'div.hero', 0, 500, 2000)
        expect(buf.slotAt(0)!.isDirty).toBe(true)
      }
    })

    it('mutates in-place (same object reference)', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        const slotBefore = buf.slotAt(0)
        const writeResult = buf.write(IntentType.CLICK, 'x', 0, 0, 1)
        expect(writeResult.isOk()).toBe(true)
        if (writeResult.isOk()) {
          expect(writeResult.value).toBe(slotBefore)
        }
      }
    })

    it('consecutive writes use consecutive slots', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'a', 0, 0, 1)
        buf.write(IntentType.SCROLL, 'b', 0, 0, 2)
        buf.write(IntentType.FORM_INPUT, 'c', 0, 0, 3)
        expect(buf.head).toBe(3)
        expect(buf.count).toBe(3)
        expect(buf.slotAt(0)!.targetDOMNode).toBe('a')
        expect(buf.slotAt(1)!.targetDOMNode).toBe('b')
        expect(buf.slotAt(2)!.targetDOMNode).toBe('c')
      }
    })

    it('returns Ok on write', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const writeResult = result.value.write(IntentType.CLICK, 'x', 0, 0, 1)
        expect(writeResult.isOk()).toBe(true)
      }
    })
  })

  describe('wrap-around', () => {
    it('head wraps to 0 after capacity writes', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        for (let i = 0; i < 4; i++) {
          buf.write(IntentType.CLICK, `s${i}`, 0, 0, i)
        }
        expect(buf.head).toBe(0)
        expect(buf.isFull).toBe(true)
      }
    })

    it('capacity+1 writes overwrites slot 0 with new data', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        for (let i = 0; i < 4; i++) {
          buf.write(IntentType.CLICK, `old-${i}`, 0, 0, i)
        }
        buf.write(IntentType.SCROLL, 'new-0', 99, 99, 999)
        expect(buf.slotAt(0)!.targetDOMNode).toBe('new-0')
        expect(buf.slotAt(0)!.type).toBe(IntentType.SCROLL)
        expect(buf.slotAt(0)!.timestamp).toBe(999)
      }
    })

    it('tail advances on overwrite', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        for (let i = 0; i < 4; i++) {
          buf.write(IntentType.CLICK, `s${i}`, 0, 0, i)
        }
        expect(buf.tail).toBe(0)
        buf.write(IntentType.CLICK, 'overflow', 0, 0, 100)
        expect(buf.tail).toBe(1)
      }
    })

    it('count never exceeds capacity', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        for (let i = 0; i < 10; i++) {
          buf.write(IntentType.CLICK, `s${i}`, 0, 0, i)
          expect(buf.count).toBeLessThanOrEqual(4)
        }
      }
    })
  })

  describe('collectDirty', () => {
    it('returns empty array when buffer is empty', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        expect(result.value.collectDirty()).toEqual([])
      }
    })

    it('returns N slots after N writes in FIFO order', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'first', 0, 0, 1)
        buf.write(IntentType.SCROLL, 'second', 0, 0, 2)
        buf.write(IntentType.FORM_INPUT, 'third', 0, 0, 3)

        const dirty = buf.collectDirty()
        expect(dirty).toHaveLength(3)
        expect(dirty[0]!.targetDOMNode).toBe('first')
        expect(dirty[1]!.targetDOMNode).toBe('second')
        expect(dirty[2]!.targetDOMNode).toBe('third')
      }
    })

    it('returns capacity slots after full wrap', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        for (let i = 0; i < 6; i++) {
          buf.write(IntentType.CLICK, `item-${i}`, 0, 0, i)
        }
        const dirty = buf.collectDirty()
        expect(dirty).toHaveLength(4)
        // oldest surviving should be item-2 (0,1 overwritten)
        expect(dirty[0]!.targetDOMNode).toBe('item-2')
        expect(dirty[3]!.targetDOMNode).toBe('item-5')
      }
    })

    it('excludes non-dirty slots', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'a', 0, 0, 1)
        buf.write(IntentType.CLICK, 'b', 0, 0, 2)
        // Manually clear dirty on one
        buf.slotAt(0)!.isDirty = false
        const dirty = buf.collectDirty()
        expect(dirty).toHaveLength(1)
        expect(dirty[0]!.targetDOMNode).toBe('b')
      }
    })
  })

  describe('markFlushed', () => {
    it('marks slots clean and advances tail', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'a', 10, 20, 1)
        buf.write(IntentType.SCROLL, 'b', 30, 40, 2)

        const flushResult = buf.markFlushed(2)
        expect(flushResult.isOk()).toBe(true)
        if (flushResult.isOk()) {
          expect(flushResult.value).toBe(2)
        }
        expect(buf.tail).toBe(2)
        expect(buf.count).toBe(0)
      }
    })

    it('zeroes string values but preserves id', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'target', 10, 20, 1000)

        const slotBeforeFlush = buf.slotAt(0)!
        slotBeforeFlush.site_id = 'test-site'

        buf.markFlushed(1)

        const slot = buf.slotAt(0)!
        expect(slot.id).toBe('slot-0')
        expect(slot.targetDOMNode).toBe('')
        expect(slot.isDirty).toBe(false)
        expect(slot.timestamp).toBe(0)
        expect(slot.site_id).toBe('')
      }
    })

    it('returns Err if count exceeds active entries', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'a', 0, 0, 1)
        const flushResult = buf.markFlushed(5)
        expect(flushResult.isErr()).toBe(true)
      }
    })

    it('reduces count after flush', () => {
      const result = TelemetryRingBuffer.create(8)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'a', 0, 0, 1)
        buf.write(IntentType.CLICK, 'b', 0, 0, 2)
        buf.write(IntentType.CLICK, 'c', 0, 0, 3)
        buf.markFlushed(2)
        expect(buf.count).toBe(1)
        const dirty = buf.collectDirty()
        expect(dirty).toHaveLength(1)
        expect(dirty[0]!.targetDOMNode).toBe('c')
      }
    })
  })

  describe('edge cases', () => {
    it('capacity=1 write/collect/flush cycle', () => {
      const result = TelemetryRingBuffer.create(1)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'only', 5, 10, 42)
        expect(buf.count).toBe(1)
        expect(buf.isFull).toBe(true)

        const dirty = buf.collectDirty()
        expect(dirty).toHaveLength(1)
        expect(dirty[0]!.targetDOMNode).toBe('only')

        buf.markFlushed(1)
        expect(buf.count).toBe(0)
        expect(buf.collectDirty()).toHaveLength(0)
      }
    })

    it('interleaved write/flush', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        buf.write(IntentType.CLICK, 'a', 0, 0, 1)
        buf.write(IntentType.CLICK, 'b', 0, 0, 2)
        buf.markFlushed(1)
        expect(buf.count).toBe(1)

        buf.write(IntentType.CLICK, 'c', 0, 0, 3)
        expect(buf.count).toBe(2)

        const dirty = buf.collectDirty()
        expect(dirty).toHaveLength(2)
        expect(dirty[0]!.targetDOMNode).toBe('b')
        expect(dirty[1]!.targetDOMNode).toBe('c')
      }
    })

    it('multiple full rotations', () => {
      const result = TelemetryRingBuffer.create(4)
      expect(result.isOk()).toBe(true)
      if (result.isOk()) {
        const buf = result.value
        // Write 12 items (3 full rotations)
        for (let i = 0; i < 12; i++) {
          buf.write(IntentType.CLICK, `r${i}`, 0, 0, i)
        }
        expect(buf.count).toBe(4)
        const dirty = buf.collectDirty()
        expect(dirty).toHaveLength(4)
        // Last 4 items survive: r8, r9, r10, r11
        expect(dirty[0]!.targetDOMNode).toBe('r8')
        expect(dirty[3]!.targetDOMNode).toBe('r11')
      }
    })
  })
})
