/**
 * One original in, the renditions the site serves out.
 *
 * The single copy of every decision about pixels — widths, formats, quality,
 * colour, what gets stripped. It has to be single: a photo that arrives from
 * Drive and one seeded from disk must be indistinguishable on the page, and
 * two sets of encoder settings drift apart the first time one is tuned.
 *
 * Takes a path or a buffer, so the same code serves the sync (which holds
 * downloaded bytes) and the build-time seed (which holds files).
 */
import sharp from 'sharp'

export const WIDTHS = [400, 800, 1200, 1600, 2400]

/** Page background, for compositing away transparency. Matches theme.css. */
const BACKDROP = '#0c0c0c'

const MIME = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg' }

/**
 * One prepared source.
 *
 * `rotate()` bakes EXIF orientation into the pixels, so nothing downstream
 * has to care about it — which matters more here than it did for the seed,
 * because a phone photograph carries orientation far more often than an
 * exported one.
 *
 * `flatten()` composites any alpha onto the page background: a PNG with real
 * transparency would otherwise land on black in the JPEG rendition and on
 * nothing in AVIF/WebP, so the same photo would differ by format.
 *
 * `toColourspace('srgb')` is the one addition the Drive pipeline needs.
 * Damir exports in Adobe RGB and Display P3, and sharp strips metadata by
 * default — including the ICC profile that tells a browser how to read those
 * numbers. Without the conversion, a wide-gamut photograph arrives with its
 * colours flattened and desaturated, and nothing in the output says why.
 */
export function source(input) {
  return sharp(input).rotate().flatten({ background: BACKDROP }).toColourspace('srgb')
}

/**
 * A 24px-wide blurred JPEG, inlined into the manifest as a data URI.
 *
 * Kept tiny on purpose: it ships inside the manifest on every page load, so a
 * few hundred bytes per photo is the budget. WebP would be smaller still but
 * JPEG decodes everywhere without a format negotiation.
 */
export async function lqip(input) {
  const buf = await source(input)
    .resize(24, null, { fit: 'inside' })
    .blur(1.2)
    .jpeg({ quality: 40 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

/** Intrinsic size after orientation is applied, or `null` if unreadable. */
export async function dimensions(input) {
  const meta = await sharp(input).rotate().metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  return width > 0 && height > 0 ? { width, height } : null
}

/**
 * Which widths to generate for an original this wide.
 *
 * Never upscales. A 900px original gets 400 and 800, and the manifest says
 * so — otherwise srcset promises a 2400px file that is just a blurry 900px
 * one reprinted larger. An original narrower than the smallest step still
 * gets one rendition, at its own width.
 */
export function widthsFor(width) {
  const widths = WIDTHS.filter((w) => w <= width)
  return widths.length > 0 ? widths : [width]
}

/**
 * Every rendition of one photo, in memory.
 *
 * Returned rather than written, because the two callers put them in different
 * places: R2 under a key, or the filesystem under a path. A 2400px AVIF plus
 * its siblings is a few megabytes, and they are handled one photo at a time.
 */
export async function renditions(input) {
  const size = await dimensions(input)
  if (!size) return null

  const widths = widthsFor(size.width)
  const files = []

  for (const width of widths) {
    const resized = source(input).resize(width, null, { withoutEnlargement: true })
    const [avif, webp, jpg] = await Promise.all([
      resized.clone().avif({ quality: 55, effort: 6 }).toBuffer(),
      resized.clone().webp({ quality: 74 }).toBuffer(),
      resized.clone().jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
    ])
    files.push(
      { name: `${width}.avif`, body: avif, contentType: MIME.avif },
      { name: `${width}.webp`, body: webp, contentType: MIME.webp },
      { name: `${width}.jpg`, body: jpg, contentType: MIME.jpg },
    )
  }

  return { ...size, widths, lqip: await lqip(input), files }
}
