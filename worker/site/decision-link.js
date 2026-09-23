/**
 * The Objavi / Odbij links in Damir's mail.
 *
 * Whoever holds one of these can publish or throw away a review, and they
 * travel through Gmail, so they are signed: HMAC-SHA256 over the review id,
 * the decision and an expiry, with `REVIEW_SIGNING_KEY`. Nobody without the
 * key can make one, change which review or which decision it is for, or keep
 * using an old mail forever.
 *
 * Opening a link decides nothing — see `index.js`. Mail scanners open links.
 */

export const DECISIONS = ['objavi', 'odbij']

/** Two weeks: long enough for a holiday, short enough to matter. */
export const LINK_LIFETIME_S = 14 * 24 * 60 * 60

/** Review ids are 12 hex characters; nothing else reaches an R2 key. */
export const REVIEW_ID = /^[0-9a-f]{12}$/

const utf8 = new TextEncoder()

async function key(secret) {
  if (!secret || secret.length < 32)
    throw new Error('REVIEW_SIGNING_KEY missing or too short')
  return crypto.subtle.importKey(
    'raw',
    utf8.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

const message = ({ id, decision, expires }) => `${id}:${decision}:${expires}`

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex) {
  if (!/^[0-9a-f]{64}$/.test(hex)) return null
  return new Uint8Array(hex.match(/../g).map((b) => parseInt(b, 16)))
}

/** Query parameters for a link that expires `LINK_LIFETIME_S` from `now`. */
export async function signDecision(secret, { id, decision }, now = Date.now()) {
  const expires = Math.floor(now / 1000) + LINK_LIFETIME_S
  const sig = toHex(
    await crypto.subtle.sign(
      'HMAC',
      await key(secret),
      utf8.encode(message({ id, decision, expires })),
    ),
  )
  return new URLSearchParams({ id, d: decision, exp: String(expires), sig })
}

/**
 * The decision a link carries, if the signature holds and it has not expired.
 *
 * `crypto.subtle.verify` rather than comparing strings, so the check takes
 * the same time however much of a forged signature happens to be right.
 */
export async function verifyDecision(secret, params, now = Date.now()) {
  const id = params.get('id') ?? ''
  const decision = params.get('d') ?? ''
  const expiresText = params.get('exp') ?? ''
  const sig = fromHex(params.get('sig') ?? '')

  if (!REVIEW_ID.test(id) || !DECISIONS.includes(decision) || !sig)
    return { error: 'invalid' }
  if (!/^\d{1,12}$/.test(expiresText)) return { error: 'invalid' }
  const expires = Number(expiresText)

  const valid = await crypto.subtle.verify(
    'HMAC',
    await key(secret),
    sig,
    utf8.encode(message({ id, decision, expires })),
  )
  if (!valid) return { error: 'invalid' }
  if (expires * 1000 < now) return { error: 'expired' }
  return { id, decision }
}
