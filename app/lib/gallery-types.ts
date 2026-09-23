import type { CategoryId } from './categories'

/** One rendition of a photo, as stored in R2 under img/{id}/{width}.{ext}. */
export type Rendition = {
  width: number
  height: number
}

export type Photo = {
  /**
   * Stable for the life of the photo; never reused, never rewritten.
   *
   * Derived from the Drive file id and the checksum of its contents, so
   * replacing a file produces a new id and the year-long cache on the
   * renditions stays correct without a purge.
   */
  id: string
  category: CategoryId
  /**
   * When the photo appeared on Drive, from `createdTime`. Newest first.
   *
   * There is no hand-set order any more: ordering a gallery meant an admin
   * to do it in, and the admin is what the Drive sync replaced. Damir
   * controls the order by when he adds a photo, which is the one lever a
   * folder gives him.
   */
  addedAt: string
  /** Intrinsic size of the original, for aspect-ratio and srcset sizing. */
  width: number
  height: number
  /** Widths actually generated. Never exceeds the original width. */
  widths: number[]
  /** Croatian, required. Screen readers and broken images both need it. */
  alt: string
  /** Base64 data URI, ~24px wide. Rendered instantly as a blur placeholder. */
  lqip: string
  /**
   * A number Damir put at the front of the file name on Drive, if he did.
   *
   * Absent on most photos, and meant to be: it exists for the handful he
   * wants in a particular place, and everything else keeps sorting itself.
   */
  rank?: number
}

/**
 * Where a fixed page image goes. Not a category, and not in the grid.
 *
 * `hero` is the cover photograph, `about` the portrait and `reviews` the one
 * photograph above the reviews. Each comes from its own Drive folder, so all
 * three are Damir's choice rather than something the code works out for him.
 *
 * The `Mobile` twins are optional overrides for phones, from their own
 * `-mobitel` folders. A landscape image cropped to a phone's narrow band
 * usually loses its subject, and no amount of `object-position` fixes a
 * photograph composed for a different shape — only a different photograph
 * does. Leave the folder empty and the phone shows the same one as everything
 * else.
 */
export type PageSlot =
  'hero' | 'heroMobile' | 'about' | 'aboutMobile' | 'reviews' | 'reviewsMobile'

/**
 * An image that belongs to a section rather than to a category.
 *
 * Same renditions and same LQIP as a gallery photo, deliberately not a
 * `Photo`: it has no category, and nothing about it should ever surface in a
 * category grid or the lightbox.
 */
export type PageImage = {
  id: string
  addedAt: string
  width: number
  height: number
  widths: number[]
  alt: string
  lqip: string
}

/**
 * A client's review, as approved by Damir.
 *
 * Written by the client through the form, published only after Damir
 * approves it from the mail it sends him — so everything here has been read
 * by a person before it reaches the page. See docs/plan-recenzije.md.
 */
export type Review = {
  id: string
  name: string
  /** Where the reviewer is found: Instagram, LinkedIn, a website. */
  link?: { href: string; label: string }
  /** Plain text. Paragraphs are separated by a blank line. */
  text: string
  /** Newest first, like everything else Damir adds. */
  addedAt: string
}

export type Gallery = {
  /** Bumped on every write so clients can tell versions apart. */
  version: number
  updatedAt: string
  photos: Photo[]
  /** Empty until the matching Drive folder has something in it. */
  pages: Partial<Record<PageSlot, PageImage>>
  /**
   * Optional because every manifest written before reviews existed lacks
   * it, and the build has to accept whatever the bucket currently holds.
   */
  reviews?: Review[]
}

export const EMPTY_GALLERY: Gallery = {
  version: 0,
  updatedAt: new Date(0).toISOString(),
  photos: [],
  pages: {},
}

/**
 * Photos in one category: the ones Damir numbered first, then the rest.
 *
 * Numbered photos lead, highest number first, because that is how he asked
 * for it — the same direction as everything else here, where the newest
 * thing is the thing in front.
 *
 * Everything unnumbered falls in behind, newest first. That is the common
 * case and needs no work from him; numbering is for the few photographs
 * whose position he actually cares about.
 *
 * Ties break on id so the order is total: two photos dropped into a folder
 * in the same operation share a `createdTime` to the minute — Drive stamps a
 * whole batch alike — and an unstable sort would shuffle them between builds
 * for no reason a visitor could see.
 */
export function photosInCategory(gallery: Gallery, category: CategoryId): Photo[] {
  const byRecency = (a: Photo, b: Photo) =>
    b.addedAt.localeCompare(a.addedAt) || a.id.localeCompare(b.id)

  return gallery.photos
    .filter((p) => p.category === category)
    .sort((a, b) => {
      if (a.rank !== undefined && b.rank !== undefined) {
        return b.rank - a.rank || byRecency(a, b)
      }
      if (a.rank !== undefined) return -1
      if (b.rank !== undefined) return 1
      return byRecency(a, b)
    })
}

/**
 * Every review, newest first, once each.
 *
 * Takes several lists because reviews arrive from two places — the ones
 * carried over from Wfolio live in the repository, and the ones approved
 * since arrive in the manifest — and a review in both counts once. Ties on
 * id, for the same reason as `photosInCategory`.
 */
export function reviewsNewestFirst(...lists: (Review[] | undefined)[]): Review[] {
  const byId = new Map<string, Review>()
  for (const review of lists.flatMap((list) => list ?? [])) byId.set(review.id, review)
  return [...byId.values()].sort(
    (a, b) => b.addedAt.localeCompare(a.addedAt) || a.id.localeCompare(b.id),
  )
}

/** Aspect ratio, guarding against a malformed manifest entry. */
export function aspect(photo: Pick<Photo, 'width' | 'height'>): number {
  return photo.height > 0 ? photo.width / photo.height : 1
}
