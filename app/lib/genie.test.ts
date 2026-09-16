import { describe, expect, it } from 'vitest'
import { geniePolygon, genieKeyframes } from './genie'

const neck = { cx: 50, cy: 90, half: 8 }
/** A slot hard against the right edge — the case that used to stay cropped. */
const offCentre = { cx: 88, cy: 40, half: 6 }

const points = (poly: string) =>
  poly
    .replace(/^polygon\(|\)$/g, '')
    .split(', ')
    .map((pair) => pair.split(' ').map((n) => Number.parseFloat(n)) as [number, number])

describe('geniePolygon', () => {
  it('clips nothing once it is open, wherever the slot was', () => {
    for (const n of [neck, offCentre]) {
      const pts = points(geniePolygon(1, n))
      expect(Math.min(...pts.map(([x]) => x))).toBe(0)
      expect(Math.max(...pts.map(([x]) => x))).toBe(100)
      expect(Math.min(...pts.map(([, y]) => y))).toBe(0)
      expect(Math.max(...pts.map(([, y]) => y))).toBe(100)
    }
  })

  it('clips nothing once it is open', () => {
    // Every point sits on the edge of the box, so the finished photo is
    // uncropped — but the point count still matches every other frame.
    const pts = points(geniePolygon(1, neck))
    for (const [x, y] of pts) {
      expect(x === 0 || x === 100 || y === 0 || y === 100).toBe(true)
    }
    expect(Math.min(...pts.map(([x]) => x))).toBe(0)
    expect(Math.max(...pts.map(([x]) => x))).toBe(100)
    expect(geniePolygon(1.4, neck)).toBe(geniePolygon(1, neck))
  })

  it('is pinched at the slot and wider away from it', () => {
    // This is the bow: the same shape is narrow on the slot's row and
    // already open further up.
    const pts = points(geniePolygon(0.35, neck))
    const right = pts.filter(([x]) => x > neck.cx)
    const atSlot = right.reduce((a, b) =>
      Math.abs(a[1] - neck.cy) < Math.abs(b[1] - neck.cy) ? a : b,
    )
    const farthest = right.reduce((a, b) =>
      Math.abs(a[1] - neck.cy) > Math.abs(b[1] - neck.cy) ? a : b,
    )
    expect(farthest[0]).toBeGreaterThan(atSlot[0])
  })

  it('opens the neck itself, not just the ends', () => {
    // Measured on the slot's own row. The widest row reaches 100% early and
    // then stops, so it says nothing about the second half of the animation.
    const neckWidth = (p: number) => {
      const pts = points(geniePolygon(p, neck)).filter(([x]) => x > neck.cx)
      const at = pts.reduce((a, b) =>
        Math.abs(a[1] - neck.cy) < Math.abs(b[1] - neck.cy) ? a : b,
      )
      return at[0]
    }
    expect(neckWidth(0.5)).toBeGreaterThan(neckWidth(0.15))
    expect(neckWidth(0.9)).toBeGreaterThan(neckWidth(0.5))
  })

  it('stays inside the box', () => {
    // A polygon that runs past 100% would clip nothing on that edge and
    // quietly undo the taper.
    for (const p of [0, 0.25, 0.5, 0.75, 0.99]) {
      for (const [x, y] of points(geniePolygon(p, neck))) {
        expect(x).toBeGreaterThanOrEqual(-0.01)
        expect(x).toBeLessThanOrEqual(100.01)
        expect(y).toBeGreaterThanOrEqual(-0.01)
        expect(y).toBeLessThanOrEqual(100.01)
      }
    }
  })

  it('keeps every keyframe the same point count', () => {
    // The browser interpolates polygons point by point and falls back to a
    // hard cut if two keyframes disagree on the count. An earlier version
    // ended on a four-point rectangle and snapped on the last frame.
    const counts = new Set(genieKeyframes(neck).map((k) => points(k.clipPath).length))
    expect(counts.size).toBe(1)
  })
})
