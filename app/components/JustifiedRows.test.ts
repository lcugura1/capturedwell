import { describe, expect, it } from 'vitest'
import { rowsOf } from './JustifiedRows'
import type { Photo } from '~/lib/gallery-types'

const p = (id: string, w: number, h: number): Photo => ({
  id,
  category: 'products',
  addedAt: '2026-01-01T00:00:00.000Z',
  width: w,
  height: h,
  widths: [400],
  alt: '',
  lqip: '',
})

describe('rowsOf', () => {
  it('closes a row once its combined aspect reaches the target', () => {
    // Three 1:1 photos against a target of 2.6: the first two sum to 2.0
    // and stay open, the third pushes past it and closes the row.
    const rows = rowsOf([p('a', 100, 100), p('b', 100, 100), p('c', 100, 100)], 2.6)
    expect(rows.map((r) => r.map((x) => x.id))).toEqual([['a', 'b', 'c']])
  })

  it('puts wide photos in shorter rows', () => {
    // Two 16:9 photos already overshoot 2.6, so they fill a row on their own.
    const rows = rowsOf([p('a', 1600, 900), p('b', 1600, 900), p('c', 1600, 900)], 2.6)
    expect(rows[0]?.map((x) => x.id)).toEqual(['a', 'b'])
    expect(rows[1]?.map((x) => x.id)).toEqual(['c'])
  })

  it('leaves the trailing row short rather than stretching it', () => {
    // A single leftover photo blown up to full width reads as the feature
    // of the page when it is just the last one in the list.
    const rows = rowsOf([p('a', 100, 100), p('b', 100, 100), p('c', 100, 100), p('d', 100, 100)], 2.6)
    expect(rows.at(-1)).toHaveLength(1)
  })

  it('returns nothing for an empty category', () => {
    expect(rowsOf([], 2.6)).toEqual([])
  })
})
