/**
 * The only place category identity is defined.
 *
 * Categories are fixed: Damir cannot add or remove them from the admin.
 * Adding one is a code change, which is deliberate — the homepage, the
 * gallery overview and the prerender list all assume this set.
 *
 * Slugs carry no diacritics. `/galerija/vjencanja` stays readable when
 * pasted into a message; `/galerija/vjenčanja` becomes percent-encoded
 * noise the moment it leaves the browser.
 */
export const CATEGORIES = [
  { id: 'weddings', slug: 'vjencanja', name: 'vjenčanja' },
  { id: 'lifestyle', slug: 'lifestyle', name: 'lifestyle' },
  { id: 'events', slug: 'dogadaji', name: 'događaji' },
  { id: 'studio', slug: 'studio', name: 'studio' },
] as const

export type Category = (typeof CATEGORIES)[number]
export type CategoryId = Category['id']
export type CategorySlug = Category['slug']

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug)
}

export function categoryById(id: CategoryId): Category {
  const found = CATEGORIES.find((c) => c.id === id)
  // CategoryId is a union of the ids above, so this cannot happen at
  // runtime unless the array and the type drift apart.
  if (!found) throw new Error(`Unknown category id: ${id}`)
  return found
}

/** The category after this one, wrapping — drives the "sljedeće: …" link. */
export function nextCategory(slug: string): Category {
  const i = CATEGORIES.findIndex((c) => c.slug === slug)
  return CATEGORIES[(i + 1) % CATEGORIES.length]!
}
