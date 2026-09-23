/**
 * What a stranger may put into a review, and what it becomes if they do.
 *
 * The form in the browser checks the same limits so a visitor hears about
 * them before sending; this is the check that counts, because anything can
 * post to the endpoint without ever loading the form.
 *
 * Returns Croatian messages: they go straight back to the form.
 */

export const LIMITS = { name: 80, text: 2000, link: 300 }

/** Shorter than this is not a review, it is a test or a stray tap. */
const MIN_TEXT = 10
const MIN_NAME = 2

/**
 * The networks a reviewer may link, by registrable domain.
 *
 * Only three, as Damir asked. A free-form link would be a way to put any URL
 * on the site with a review wrapped around it — and the review is where he
 * looks, not the href.
 */
const NETWORKS = [
  { domain: 'instagram.com', label: 'Instagram' },
  { domain: 'facebook.com', label: 'Facebook' },
  { domain: 'linkedin.com', label: 'LinkedIn' },
]

/**
 * Control characters other than tab and newline, zero-width marks and
 * bidirectional overrides. None has any business in a review, and several
 * can hide or reorder text in front of the person approving it.
 */
/* eslint-disable no-control-regex -- matching control characters is the point */
const INVISIBLE =
  /[\u0000-\u0008\u000b-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g
/* eslint-enable no-control-regex */

/** Collapse runs of spaces, keep paragraph breaks, trim the ends. */
function tidy(value, { multiline }) {
  const lines = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(INVISIBLE, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
  if (!multiline) return lines.join(' ').trim()
  // At most one blank line between paragraphs.
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * A profile link on one of the three networks, or an error.
 *
 * Accepts what people actually type: `instagram.com/ana`, with or without
 * `https://` and `www.`. Rebuilt from its parts rather than passed through,
 * so what is stored is always an https URL on the network's own host.
 */
export function parseLink(raw) {
  const value = tidy(raw, { multiline: false })
  if (!value) return { link: undefined }
  if (value.length > LIMITS.link) return { error: 'Link je predug.' }

  let url
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`)
  } catch {
    return { error: 'Link nije ispravan.' }
  }

  const host = url.hostname.toLowerCase()
  const network = NETWORKS.find((n) => host === n.domain || host.endsWith(`.${n.domain}`))
  if (!network || (url.protocol !== 'https:' && url.protocol !== 'http:')) {
    return { error: 'Link mora voditi na Instagram, Facebook ili LinkedIn profil.' }
  }
  if (url.username || url.password || url.port) {
    return { error: 'Link nije ispravan.' }
  }
  if (url.pathname === '/' || url.pathname === '') {
    return { error: 'Link mora voditi na profil, ne na naslovnicu mreže.' }
  }

  // The query string is mostly share tracking (`?igsh=…`) and goes. The one
  // exception is a Facebook profile without a username, which is nothing
  // but its query string.
  const search = url.pathname === '/profile.php' ? url.search : ''
  return {
    link: { href: `https://${host}${url.pathname}${search}`, label: network.label },
  }
}

/**
 * The review as it will be stored, or the first thing wrong with it.
 *
 * @returns {{ review: { name: string, text: string, link?: { href: string, label: string } } } | { error: string }}
 */
export function parseReview(input) {
  const name = tidy(input?.name, { multiline: false })
  const text = tidy(input?.text, { multiline: true })

  if (name.length < MIN_NAME) return { error: 'Upiši ime i prezime.' }
  if (name.length > LIMITS.name) return { error: 'Ime je predugo.' }
  if (text.length < MIN_TEXT) return { error: 'Recenzija je prekratka.' }
  if (text.length > LIMITS.text)
    return { error: `Recenzija može imati najviše ${LIMITS.text} znakova.` }

  const { link, error } = parseLink(input?.link)
  if (error) return { error }

  return { review: { name, text, ...(link ? { link } : {}) } }
}
