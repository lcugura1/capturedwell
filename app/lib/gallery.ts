import manifest from '~/data/gallery.json'
import type { Gallery } from './gallery-types'

/**
 * The manifest, baked into the build.
 *
 * Importing rather than fetching means every gallery page ships with its
 * photos already in the HTML: good for search engines, and one fewer
 * round-trip before anything appears. The cost is that a new upload needs a
 * rebuild — which is why phase 4 has the admin Worker trigger a deploy after
 * it writes to R2. For a portfolio that changes now and then, that trade is
 * the right way round.
 */
export const gallery = manifest as Gallery
