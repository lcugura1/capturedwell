import { useState } from 'react'
import { aspectOf, fallbackSrc, srcSet, type Kind, type Renderable } from '~/lib/images'

/**
 * Below this width, an art-directed photo swaps to its phone crop.
 *
 * Tailwind's `md`. Both places that use art direction want the same answer:
 * their boxes are full-width and roughly a screen-height tall below it, which
 * is upright on a phone and wide on anything larger — the crossover for
 * ordinary device shapes lands around 500-600px, and `md` is the nearest
 * breakpoint above it.
 *
 * Written out rather than read from a custom property because a media query
 * cannot read one. Its twin is the `.lqip` rule in theme.css, and the two
 * have to move together.
 */
const PHONE = '(width < 48rem)'

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
  mobile,
  objectPosition,
  alt,
  sizes,
  kind = 'img',
  fill = false,
  priority = false,
  className = '',
}: {
  photo: Renderable & { alt?: string }
  /**
   * A different photograph to show on phones — art direction, not a size.
   *
   * `srcset` already picks the right *resolution*; this is for when the
   * right *picture* differs, which on a full-bleed cover it usually does.
   * The browser evaluates the media-scoped sources first and downloads
   * exactly one image, so the unused cover costs nothing.
   */
  mobile?: Renderable
  /**
   * Which part of the photograph to keep when the box crops it.
   *
   * Only bites under `fill`, and in practice only on a phone: a wide cover in
   * a wide frame is trimmed top and bottom, where the horizontal position has
   * nothing to say. Turned sideways into a phone's tall band it is trimmed
   * hard at the sides instead, and `center` is only right if the subject
   * happens to sit in the middle of the frame. Rarely does.
   */
  objectPosition?: string
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
      {/* First match wins, so the phone crop has to come first — and it
          needs the JPEG line too, or a browser without AVIF or WebP falls
          past all three and lands on the desktop <img>. */}
      {mobile && (
        <>
          <source
            media={PHONE}
            type="image/avif"
            srcSet={srcSet(mobile, 'avif', kind)}
            sizes={sizes}
          />
          <source
            media={PHONE}
            type="image/webp"
            srcSet={srcSet(mobile, 'webp', kind)}
            sizes={sizes}
          />
          <source media={PHONE} srcSet={srcSet(mobile, 'jpg', kind)} sizes={sizes} />
        </>
      )}
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
        className={`size-full object-cover ${loaded ? '' : 'lqip'} ${className}`}
        style={
          {
            // Reserves the right box before the photo arrives, which is what
            // keeps layout shift at zero. Skipped under `fill`, where the
            // parent owns the box and this would fight it.
            aspectRatio: fill ? undefined : aspectOf(photo),
            objectPosition,
            // Handed to CSS rather than set here, because which blur belongs
            // on screen is a media query's business and inline styles cannot
            // ask. See `.lqip` in theme.css.
            '--lqip': `url("${photo.lqip}")`,
            ...(mobile ? { '--lqip-phone': `url("${mobile.lqip}")` } : {}),
          } as React.CSSProperties
        }
      />
    </picture>
  )
}
