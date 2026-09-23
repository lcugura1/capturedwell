import { CATEGORIES } from './categories'

/**
 * Everything about the business that is not a photo.
 *
 * Damir edits photographs on Drive and nothing else: copy lives in code and
 * changes through a commit. That was a deliberate call, and it is why there
 * is no admin. This file is where a non-developer should be pointed first.
 *
 * TODO(Damir): every value marked PLACEHOLDER needs the real thing before launch.
 */
export const SITE = {
  name: 'capturedwell',
  owner: 'Damir Sukop',
  role: 'fotograf',
  url: 'https://capturedwell.com',
  /**
   * Split so the address is never a literal `mailto:` in the served HTML.
   *
   * A Gmail address rather than one on the domain, deliberately: the account
   * that controls the domain's DNS must not depend on mail *at* that domain
   * to exist. See docs/plan-drive-sync.md, A1.
   */
  email: { user: 'capturedwell1', domain: 'gmail.com' },
  /** Set to null to hide the row entirely. */
  phone: '+385 95 711 9680' as string | null,
  instagram: {
    handle: '@capturedwell_',
    url: 'https://instagram.com/capturedwell_',
  },
  /** PLACEHOLDER — used in the About page and the JSON-LD area served. */
  city: 'Zagreb',
  /**
   * The occasions Damir shoots, in the order they appear in the hero.
   *
   * Kept identical to the gallery's categories on purpose. A visitor who
   * reads one of these and then cannot find it in the gallery below has
   * been told something the site does not back up.
   */
  shoots: CATEGORIES.map((c) => c.name),
} as const

/**
 * The wordmark as text, underscore and all.
 *
 * One constant because the mark appears in three places that have already
 * drifted apart once — the header carries it as the traced SVG, the hero
 * sets it at display size, and the footer as type. The suffix is part of
 * the name, not punctuation someone remembers to add.
 */
export const WORDMARK = `${SITE.name}_`

export const EMAIL_TEXT = `${SITE.email.user}@${SITE.email.domain}`

/**
 * The subject line on an enquiry, so Damir can tell where it came from.
 *
 * Derived rather than written out. It was a literal in two files, and when
 * the domain moved from .hr to .com both were left saying the old one — in
 * the one string a client actually sees, sitting in their sent folder.
 */
export const ENQUIRY_SUBJECT = `Upit preko ${new URL(SITE.url).host}`

/**
 * Builds the mailto: only when someone actually reaches for it.
 *
 * The address itself is visible on the contact page — the design calls for
 * that — so this is not real obfuscation. What it does buy is that the
 * served HTML contains no `mailto:` href, which is the pattern the cheap
 * harvesters grep for. Anything that renders the page and reads text will
 * still find the address, and that is an accepted trade.
 */
export function mailtoHref(subject?: string): string {
  const base = `mailto:${SITE.email.user}@${SITE.email.domain}`
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base
}

/**
 * Turnstile's site key for the review form. Public by design — it is in the
 * HTML of every page that shows a widget — so it lives here, not in a secret.
 *
 * Cloudflare's always-pass test key until the real widget exists, and in
 * development always: the real key refuses `localhost`. The Worker's secret
 * has to be the matching test secret for as long as this is the test key.
 */
const TURNSTILE_TEST_KEY = '1x00000000000000000000AA'
const TURNSTILE_KEY: string | null = null

export const TURNSTILE_SITE_KEY =
  import.meta.env.DEV || !TURNSTILE_KEY ? TURNSTILE_TEST_KEY : TURNSTILE_KEY

/** Mirrors LIMITS in worker/site/review-input.js, which is the check that counts. */
export const REVIEW_LIMITS = { name: 80, text: 2000, link: 300 } as const
