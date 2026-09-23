import { describe, expect, it } from 'vitest'
import { parseLink, parseReview } from './review-input.js'
import { signDecision, verifyDecision, LINK_LIFETIME_S } from './decision-link.js'
import { escape } from './views.js'

const KEY = 'k'.repeat(48)

describe('parseLink', () => {
  it.each([
    ['instagram.com/ana', 'https://instagram.com/ana', 'Instagram'],
    [
      'https://www.instagram.com/ana/?igsh=abc',
      'https://www.instagram.com/ana/',
      'Instagram',
    ],
    ['http://m.facebook.com/ana.anic', 'https://m.facebook.com/ana.anic', 'Facebook'],
    [
      'https://www.facebook.com/profile.php?id=100',
      'https://www.facebook.com/profile.php?id=100',
      'Facebook',
    ],
    ['hr.linkedin.com/in/ana', 'https://hr.linkedin.com/in/ana', 'LinkedIn'],
  ])('accepts %s', (raw, href, label) => {
    expect(parseLink(raw)).toEqual({ link: { href, label } })
  })

  it('treats an empty field as no link', () => {
    expect(parseLink('   ')).toEqual({ link: undefined })
  })

  it.each([
    'javascript:alert(1)//instagram.com/x',
    'https://example.com/instagram.com',
    'https://instagram.com.evil.hr/ana',
    'https://notinstagram.com/ana',
    'https://user@instagram.com/ana',
    'https://instagram.com',
    'ftp://instagram.com/ana',
  ])('refuses %s', (raw) => {
    expect(parseLink(raw).error).toBeTruthy()
  })
})

describe('parseReview', () => {
  const valid = { name: 'Ana Anić', text: 'Sve je bilo odlično, hvala!' }

  it('tidies whitespace and keeps paragraphs', () => {
    const { review } = parseReview({
      name: '  Ana   Anić ',
      text: 'Prvi  odlomak.\r\n\r\n\r\n\r\nDrugi.\u202e',
    })
    expect(review).toEqual({ name: 'Ana Anić', text: 'Prvi odlomak.\n\nDrugi.' })
  })

  it('refuses short and long input', () => {
    expect(parseReview({ ...valid, name: 'A' }).error).toBeTruthy()
    expect(parseReview({ ...valid, text: 'kratko' }).error).toBeTruthy()
    expect(parseReview({ ...valid, text: 'a'.repeat(2001) }).error).toBeTruthy()
    expect(parseReview({ ...valid, name: 'a'.repeat(81) }).error).toBeTruthy()
  })

  it('passes a link error through', () => {
    expect(parseReview({ ...valid, link: 'https://example.com/ana' }).error).toMatch(
      /Instagram/,
    )
  })

  it('ignores fields it does not know', () => {
    const { review } = parseReview({ ...valid, id: 'x', addedAt: 'y', html: '<b>' })
    expect(Object.keys(review).sort()).toEqual(['name', 'text'])
  })
})

describe('decision links', () => {
  const now = Date.UTC(2026, 8, 23)

  it('verifies what it signed', async () => {
    const params = await signDecision(
      KEY,
      { id: 'abcdef012345', decision: 'objavi' },
      now,
    )
    expect(await verifyDecision(KEY, params, now)).toEqual({
      id: 'abcdef012345',
      decision: 'objavi',
    })
  })

  it('refuses a link turned into the other decision', async () => {
    const params = await signDecision(KEY, { id: 'abcdef012345', decision: 'odbij' }, now)
    params.set('d', 'objavi')
    expect(await verifyDecision(KEY, params, now)).toEqual({ error: 'invalid' })
  })

  it('refuses a link moved to another review, or signed with another key', async () => {
    const params = await signDecision(
      KEY,
      { id: 'abcdef012345', decision: 'objavi' },
      now,
    )
    params.set('id', 'abcdef012346')
    expect(await verifyDecision(KEY, params, now)).toEqual({ error: 'invalid' })

    const other = await signDecision(
      'x'.repeat(48),
      { id: 'abcdef012345', decision: 'objavi' },
      now,
    )
    expect(await verifyDecision(KEY, other, now)).toEqual({ error: 'invalid' })
  })

  it('expires', async () => {
    const params = await signDecision(
      KEY,
      { id: 'abcdef012345', decision: 'objavi' },
      now,
    )
    const later = now + (LINK_LIFETIME_S + 1) * 1000
    expect(await verifyDecision(KEY, params, later)).toEqual({ error: 'expired' })
  })

  it('refuses an id that could escape its R2 prefix', async () => {
    const params = await signDecision(
      KEY,
      { id: '../approved/x', decision: 'objavi' },
      now,
    )
    expect(await verifyDecision(KEY, params, now)).toEqual({ error: 'invalid' })
  })
})

describe('escape', () => {
  it('neutralises markup', () => {
    expect(escape(`<img src=x onerror="a('b')">&`)).toBe(
      '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;',
    )
  })
})
