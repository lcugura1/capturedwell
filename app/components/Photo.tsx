import { useState } from 'react'
import { aspectOf, fallbackSrc, srcSet, type Kind, type Renderable } from '~/lib/images'

/**
 * One photograph, at the right size for the viewport.
 *
 * Three things here are load-bearing for how fast the site feels:
 *
 * 1. AVIF first, WebP second, JPEG last. The browser takes the first it
 *    understands, so modern clients never download the JPEG.
 * 2. The LQIP — a ~24px blur from the manifest — paints as the element's
 *    background immediately, so there is never an empty hole where a photo
 *    is about to be. It is cleared once the real image decodes, otherwise
 *    a transparent PNG would show the blur through it forever.
 * 3. `aspect-ratio` from the manifest reserves the exact box before the
 *    photo arrives, which is what keeps layout shift at zero.
 *
 * `sizes` has no universally right answer, so callers pass what their
 * layout actually does. Getting it wrong costs bandwidth, not correctness.
 */
export function Photo({
  photo,
  alt,
  sizes,
  kind = 'img',
  fill = false,
  priority = false,
  className = '',
}: {
  photo: Renderable & { alt?: string }
  /** Overrides the manifest's alt — page images carry no alt of their own. */
  alt?: string
  sizes: string
  kind?: Kind
  /**
   * Let the parent decide the box and crop the photo into it.
   *
   * Without this the photo always sizes itself from its own ratio, which
   * is right for a grid but wrong for the hero, where the height is
   * whatever the viewport has left. Setting `height: 100%` is not enough:
   * <picture> is an inline element with no definite height, so the
   * percentage never resolves and `aspect-ratio` silently takes over —
   * which is exactly how the hero grew past the fold. Absolute
   * positioning skips the percentage chain entirely.
   *
   * The parent must be positioned. There is no aspect-ratio to reserve
   * the box in this mode, and none is needed: the parent already has a
   * height before the photo arrives, so there is nothing to shift.
   */
  fill?: boolean
  /** Set on the one photo above the fold. Never on more than one. */
  priority?: boolean
  className?: string
}) {
  const [loaded, setLoaded] = useState(false)

  return (
    <picture className={fill ? 'absolute inset-0 block size-full' : undefined}>
      <source type="image/avif" srcSet={srcSet(photo, 'avif', kind)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSet(photo, 'webp', kind)} sizes={sizes} />
      <img
        src={fallbackSrc(photo, kind)}
        srcSet={srcSet(photo, 'jpg', kind)}
        sizes={sizes}
        alt={alt ?? photo.alt ?? ''}
        width={photo.width}
        height={photo.height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchPriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        className={`size-full object-cover ${className}`}
        style={{
          // Reserves the right box before the photo arrives, which is what
          // keeps layout shift at zero. Skipped under `fill`, where the
          // parent owns the box and this would fight it.
          aspectRatio: fill ? undefined : aspectOf(photo),
          backgroundImage: loaded ? undefined : `url("${photo.lqip}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    </picture>
  )
}
