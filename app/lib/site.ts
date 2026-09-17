/**
 * Everything about the business that is not a photo.
 *
 * Damir does not edit text through the admin — that was a deliberate call, so
 * copy lives in code and changes through a commit. This file is where a
 * non-developer should be pointed first.
 *
 * TODO(Damir): every value marked PLACEHOLDER needs the real thing before launch.
 */
export const SITE = {
  name: 'capturedwell',
  owner: 'Damir Sukop',
  role: 'fotograf',
  url: 'https://capturedwell.hr',
  /** PLACEHOLDER — split so the address is never a literal mailto: in the HTML. */
  email: { user: 'info', domain: 'capturedwell.hr' },
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
   * Not the same list as the gallery's four categories, and deliberately
   * so — this answers "is this photographer for me", which is the first
   * question a visitor has, while the categories organise the work that
   * already exists. They will need reconciling before launch.
   */
  shoots: ['vjenčanja', 'krštenja', 'proizvodi', 'studio'],
} as const

export const EMAIL_TEXT = `${SITE.email.user}@${SITE.email.domain}`

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
