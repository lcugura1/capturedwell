/**
 * Where the renditions are served from.
 *
 * The bucket's own custom domain, so images come from R2 directly and never
 * through the site's Worker. `VITE_MEDIA_BASE` overrides it for pointing a
 * local build at a different bucket; the default is the real one, so a fresh
 * checkout with no environment renders real photographs rather than 404s.
 */
const BASE =
  (import.meta.env.VITE_MEDIA_BASE as string | undefined) ??
  'https://img.capturedwell.com'

/** The widths the upload pipeline generates. Never upscales past the original. */
export const WIDTHS = [400, 800, 1200, 1600, 2400] as const

export type Format = 'avif' | 'webp' | 'jpg'

/**
 * Anything with renditions on disk: a gallery photo or a fixed page image.
 * Keeping this narrower than `Photo` lets the About portrait reuse the same
 * rendering path without pretending to belong to a category.
 */
export type Renderable = {
  id: string
  width: number
  height: number
  widths: number[]
  lqip: string
}

/** `img/` is gallery content; `page/` is furniture that belongs to a route. */
export type Kind = 'img' | 'page'

export function src(
  image: Renderable,
  width: number,
  format: Format,
  kind: Kind = 'img',
) {
  return `${BASE}/${kind}/${image.id}/${width}.${format}`
}

export function srcSet(image: Renderable, format: Format, kind: Kind = 'img'): string {
  return image.widths.map((w) => `${src(image, w, format, kind)} ${w}w`).join(', ')
}

/**
 * The widest rendition, used as the <img src> fallback.
 *
 * `widths` comes from a JSON manifest, so it can be empty or malformed
 * without TypeScript noticing; fall back to the smallest standard width
 * rather than producing `undefined` in a URL.
 */
export function fallbackSrc(image: Renderable, kind: Kind = 'img'): string {
  const widest = image.widths.length > 0 ? Math.max(...image.widths) : WIDTHS[0]
  return src(image, widest, 'jpg', kind)
}

/** Aspect ratio, guarding against a malformed manifest entry. */
export function aspectOf(image: Pick<Renderable, 'width' | 'height'>): number {
  return image.height > 0 ? image.width / image.height : 1
}
