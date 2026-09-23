/**
 * Which Drive folder feeds which part of the site, and what we accept in one.
 *
 * The folder names are the category slugs from `app/lib/categories.ts`, which
 * stays the source of truth for the site itself. They are repeated here
 * because a `.mjs` script cannot import the TypeScript module, and repeated
 * *once* rather than in every script that touches Drive — rename a category
 * and this is the only place outside `categories.ts` to follow.
 */

/** Drive folder name -> category id in the manifest. */
export const CATEGORY_FOLDERS = {
  vjencanja: 'weddings',
  lifestyle: 'lifestyle',
  proizvodi: 'products',
  eventi: 'events',
}

/**
 * Croatian category names, for the alt text a photo falls back to.
 *
 * Mirrors `name` in `app/lib/categories.ts` for the same reason the folder
 * names are here: a `.mjs` script cannot import the TypeScript module.
 */
export const CATEGORY_NAMES = {
  weddings: 'vjenčanja',
  lifestyle: 'lifestyle',
  products: 'proizvodi',
  events: 'eventi',
}

/**
 * Folders that feed one fixed image each, rather than a category grid.
 *
 * The newest file in the folder wins, so replacing any of them is a matter
 * of dropping a new one in — and `naslovna` exists precisely so the cover is
 * chosen rather than computed. It used to be whichever gallery photo happened
 * to be widest, which is a heuristic, not an editorial decision: the first
 * thing a visitor sees was decided by an aspect ratio.
 *
 * One rule, twice: the plain folder is the image, and a `-mobitel` twin
 * overrides it on phones. Both twins are optional — leave one empty and the
 * phone simply uses the same photograph as everything else.
 *
 * They exist because a phone shows a tall, narrow slice of a landscape
 * photograph, and the couple who were centred on a desktop end up cropped out
 * of frame. No amount of `object-position` fixes a picture composed for a
 * different shape; only a different picture does.
 */
export const PAGE_FOLDERS = {
  naslovna: 'hero',
  'naslovna-mobitel': 'heroMobile',
  'o-meni': 'about',
  'o-meni-mobitel': 'aboutMobile',
  recenzije: 'reviews',
  'recenzije-mobitel': 'reviewsMobile',
}

/**
 * Alt text for a page image with no description on Drive.
 *
 * Thin on purpose — nothing here knows what is in the photograph. Both are
 * worth Damir's time in the Drive description field; the hero especially,
 * since it is the first image on the page and the one search engines weigh.
 */
export const PAGE_ALT = {
  hero: 'Fotografija Damira Sukopa',
  heroMobile: 'Fotografija Damira Sukopa',
  about: 'Damir Sukop, portret',
  aboutMobile: 'Damir Sukop, portret',
  reviews: 'Fotografija Damira Sukopa',
  reviewsMobile: 'Fotografija Damira Sukopa',
}

export const EXPECTED_FOLDERS = [
  ...Object.keys(CATEGORY_FOLDERS),
  ...Object.keys(PAGE_FOLDERS),
]

/**
 * What sharp can open without a detour.
 *
 * HEIC is the notable absence: iPhones shoot it by default, sharp's prebuilt
 * binaries cannot decode it, and a photo that silently never appears is worse
 * than one that reports itself. The sync skips these and says so.
 */
export const SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/gif',
])

/** R2 rejects nothing, but a 100 MB original is a mistake, not a photograph. */
export const MAX_BYTES = 100 * 1024 * 1024
