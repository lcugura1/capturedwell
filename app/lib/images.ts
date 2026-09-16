import type { Photo } from './gallery-types'

/**
 * Public R2 base. Set at build time; falls back to a relative path so the
 * site still renders (with broken images) rather than crashing when the
 * variable is missing in a fresh checkout.
 */
const BASE = (import.meta.env.VITE_MEDIA_BASE as string | undefined) ?? '/media'

/** The widths the upload pipeline generates. Never upscales past the original. */
export const WIDTHS = [400, 800, 1200, 1600, 2400] as const

export type Format = 'avif' | 'webp' | 'jpg'

export function src(photo: Photo, width: number, format: Format): string {
  return `${BASE}/img/${photo.id}/${width}.${format}`
}

export function srcSet(photo: Photo, format: Format): string {
  return photo.widths.map((w) => `${src(photo, w, format)} ${w}w`).join(', ')
}

/**
 * The widest rendition, used as the <img src> fallback.
 *
 * `widths` comes from a JSON manifest, so it can be empty or malformed
 * without TypeScript noticing; fall back to the smallest standard width
 * rather than producing `undefined` in a URL.
 */
export function fallbackSrc(photo: Photo): string {
  const widest = photo.widths.length > 0 ? Math.max(...photo.widths) : WIDTHS[0]
  return src(photo, widest, 'jpg')
}
