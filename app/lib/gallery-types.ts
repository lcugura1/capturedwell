import type { CategoryId } from './categories'

/** One rendition of a photo, as stored in R2 under img/{id}/{width}.{ext}. */
export type Rendition = {
  width: number
  height: number
}

export type Photo = {
  /** Stable for the life of the photo; never reused, never rewritten. */
  id: string
  category: CategoryId
  /** Position within the category. Lower first. */
  order: number
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
   * Photos that stay on the site permanently. Sorted to the top of their
   * category, and the admin asks for confirmation before deleting one.
   */
  pinned?: boolean
}

export type Gallery = {
  /** Bumped on every write so clients can tell versions apart. */
  version: number
  updatedAt: string
  photos: Photo[]
}

export const EMPTY_GALLERY: Gallery = {
  version: 0,
  updatedAt: new Date(0).toISOString(),
  photos: [],
}

/** Photos in one category, pinned first, then by explicit order. */
export function photosInCategory(gallery: Gallery, category: CategoryId): Photo[] {
  return gallery.photos
    .filter((p) => p.category === category)
    .sort((a, b) => Number(b.pinned ?? false) - Number(a.pinned ?? false) || a.order - b.order)
}

/** Aspect ratio, guarding against a malformed manifest entry. */
export function aspect(photo: Pick<Photo, 'width' | 'height'>): number {
  return photo.height > 0 ? photo.width / photo.height : 1
}
