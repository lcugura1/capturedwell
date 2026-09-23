import { describe, expect, it } from 'vitest'
import { photographs, plural } from './plural'

describe('plural', () => {
  it('takes the one form for 1', () => {
    expect(photographs(1)).toBe('fotografija')
  })

  it('takes the few form for 2, 3 and 4', () => {
    expect(photographs(2)).toBe('fotografije')
    expect(photographs(3)).toBe('fotografije')
    expect(photographs(4)).toBe('fotografije')
  })

  it('takes the many form from 5 upwards', () => {
    expect(photographs(5)).toBe('fotografija')
    expect(photographs(9)).toBe('fotografija')
  })

  it('treats the teens as many, whatever they end in', () => {
    // The case a naive `count === 1` or `count < 5` check gets wrong.
    expect(photographs(11)).toBe('fotografija')
    expect(photographs(12)).toBe('fotografija')
    expect(photographs(13)).toBe('fotografija')
    expect(photographs(14)).toBe('fotografija')
  })

  it('starts the cycle again past twenty', () => {
    expect(photographs(21)).toBe('fotografija')
    expect(photographs(22)).toBe('fotografije')
    expect(photographs(25)).toBe('fotografija')
    expect(photographs(101)).toBe('fotografija')
    expect(photographs(112)).toBe('fotografija')
  })

  it('works for any noun', () => {
    expect(plural(2, 'kategorija', 'kategorije', 'kategorija')).toBe('kategorije')
  })
})
