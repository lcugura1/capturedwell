/**
 * What a stranger may put into a review, and what it becomes if they do.
 *
 * The form in the browser checks the same limits so a visitor hears about
 * them before sending; this is the check that counts, because anything can
 * post to the endpoint without ever loading the form.
 *
 * Returns Croatian messages: they go straight back to the form.
 */

export const LIMITS = { name: 80, text: 2000 }

/** Shorter than this is not a review, it is a test or a stray tap. */
const MIN_TEXT = 10
const MIN_NAME = 2

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
 * The review as it will be stored, or the first thing wrong with it.
 *
 * Name and text only. Reviews carried a profile link until Damir dropped
 * it; anything still sent as `link` is ignored, never stored.
 *
 * @returns {{ review: { name: string, text: string } } | { error: string }}
 */
export function parseReview(input) {
  const name = tidy(input?.name, { multiline: false })
  const text = tidy(input?.text, { multiline: true })

  if (name.length < MIN_NAME) return { error: 'Upiši ime i prezime.' }
  if (name.length > LIMITS.name) return { error: 'Ime je predugo.' }
  if (text.length < MIN_TEXT) return { error: 'Recenzija je prekratka.' }
  if (text.length > LIMITS.text)
    return { error: `Recenzija može imati najviše ${LIMITS.text} znakova.` }

  return { review: { name, text } }
}
