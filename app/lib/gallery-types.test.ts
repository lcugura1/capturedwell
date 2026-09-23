import { describe, expect, it } from 'vitest'
import { photosInCategory, aspect, type Gallery, type Photo } from './gallery-types'

function photo(over: Partial<Photo> & Pick<Photo, 'id'>): Photo {
  return {
    category: 'products',
    addedAt: '2026-01-01T00:00:00.000Z',
    width: 1000,
    height: 1000,
    widths: [400, 800],
    alt: 'test',
    lqip: '',
    ...over,
  }
}

const gallery = (photos: Photo[]): Gallery => ({
  version: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  photos,
  pages: {},
})

describe('photosInCategory', () => {
  it('keeps only the requested category', () => {
    const g = gallery([
      photo({ id: 'a', category: 'products' }),
      photo({ id: 'b', category: 'events' }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual(['a'])
  })

  it('puts the most recently added photo first', () => {
    // What Damir controls now that there is no admin to reorder in: the
    // newest work he drops into the folder leads the category.
    const g = gallery([
      photo({ id: 'older', addedAt: '2026-01-01T00:00:00.000Z' }),
      photo({ id: 'newest', addedAt: '2026-06-01T00:00:00.000Z' }),
      photo({ id: 'middle', addedAt: '2026-03-01T00:00:00.000Z' }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual([
      'newest',
      'middle',
      'older',
    ])
  })

  it('breaks a tie on id so the order is the same every build', () => {
    // Two photos dropped into a folder together can share createdTime to the
    // millisecond; without the tiebreak they would swap places between
    // builds for no reason a visitor could see.
    const same = '2026-02-02T12:00:00.000Z'
    const g = gallery([
      photo({ id: 'b', addedAt: same }),
      photo({ id: 'a', addedAt: same }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('puts numbered photos first, highest number leading', () => {
    // Damir's lever over order: a number at the front of the file name on
    // Drive. Higher first, the same direction as everything else here.
    const g = gallery([
      photo({ id: 'plain', addedAt: '2026-09-01T00:00:00.000Z' }),
      photo({ id: 'one', rank: 1, addedAt: '2026-01-01T00:00:00.000Z' }),
      photo({ id: 'three', rank: 3, addedAt: '2026-01-01T00:00:00.000Z' }),
      photo({ id: 'two', rank: 2, addedAt: '2026-01-01T00:00:00.000Z' }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual([
      'three',
      'two',
      'one',
      'plain',
    ])
  })

  it('leaves an unnumbered photo behind every numbered one, however new', () => {
    const g = gallery([
      photo({ id: 'brand-new', addedAt: '2026-12-31T00:00:00.000Z' }),
      photo({ id: 'numbered', rank: 1, addedAt: '2020-01-01T00:00:00.000Z' }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual([
      'numbered',
      'brand-new',
    ])
  })

  it('falls back to recency when two photos share a number', () => {
    const g = gallery([
      photo({ id: 'older', rank: 2, addedAt: '2026-01-01T00:00:00.000Z' }),
      photo({ id: 'newer', rank: 2, addedAt: '2026-06-01T00:00:00.000Z' }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual(['newer', 'older'])
  })

  it('does not mind an empty category', () => {
    expect(photosInCategory(gallery([]), 'weddings')).toEqual([])
  })
})

describe('aspect', () => {
  it('returns width over height', () => {
    expect(aspect({ width: 1500, height: 1000 })).toBe(1.5)
  })

  it('falls back to square when height is missing', () => {
    // A malformed manifest entry must not produce Infinity and collapse
    // the layout — the grid divides by this value.
    expect(aspect({ width: 1000, height: 0 })).toBe(1)
  })
})
