import { describe, expect, it } from 'vitest'
import { photosInCategory, aspect, type Gallery, type Photo } from './gallery-types'

function photo(over: Partial<Photo> & Pick<Photo, 'id'>): Photo {
  return {
    category: 'products',
    order: 0,
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
})

describe('photosInCategory', () => {
  it('keeps only the requested category', () => {
    const g = gallery([
      photo({ id: 'a', category: 'products' }),
      photo({ id: 'b', category: 'events' }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual(['a'])
  })

  it('sorts by order', () => {
    const g = gallery([
      photo({ id: 'second', order: 2 }),
      photo({ id: 'first', order: 1 }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual(['first', 'second'])
  })

  it('floats pinned photos above everything else, whatever their order', () => {
    // The point of `pinned`: work Damir always wants seen first, even when
    // it was uploaded long before the rest.
    const g = gallery([
      photo({ id: 'newest', order: 1 }),
      photo({ id: 'keeper', order: 99, pinned: true }),
    ])
    expect(photosInCategory(g, 'products').map((p) => p.id)).toEqual(['keeper', 'newest'])
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
