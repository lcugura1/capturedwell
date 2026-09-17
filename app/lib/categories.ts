/**
 * The only place category identity is defined.
 *
 * Categories are fixed: Damir cannot add or remove them from the admin.
 * Adding one is a code change, which is deliberate — the gallery section
 * and its filter both assume this set.
 *
 * `slug` no longer routes anywhere: the site is one page and categories are
 * a filter inside it. It stays because it is the stable, diacritic-free
 * name for a category — the one you would put in a shareable link, an
 * analytics event or a future landing page. Slugs carry no diacritics on
 * purpose: `vjenčanja` becomes percent-encoded noise the moment it leaves
 * the browser.
 *
 * Names stay lowercase, as everything in the brand's own voice does.
 */
export const CATEGORIES = [
  { id: 'weddings', slug: 'vjencanja', name: 'vjenčanja' },
  { id: 'lifestyle', slug: 'lifestyle', name: 'lifestyle' },
  { id: 'products', slug: 'proizvodi', name: 'proizvodi' },
  { id: 'events', slug: 'eventi', name: 'eventi' },
] as const

export type Category = (typeof CATEGORIES)[number]
export type CategoryId = Category['id']
export type CategorySlug = Category['slug']
