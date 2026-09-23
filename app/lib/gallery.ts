import manifest from '~/data/gallery.json'
import type { Gallery } from './gallery-types'

/**
 * The manifest, baked into the build.
 *
 * `scripts/fetch-manifest.mjs` pulls it from R2 before the build runs, and
 * from then on it is an ordinary import: every photo, its alt text and its
 * dimensions are in the prerendered HTML, so search engines see the gallery
 * and a visitor waits on no round-trip before anything appears. The cost is
 * that a new upload needs a rebuild — which is why the sync triggers a deploy
 * once it has written to R2.
 *
 * Asserted through `unknown` on purpose. The file's contents now come from a
 * bucket rather than from the repository, so TypeScript infers a different
 * literal type for it depending on what Damir happens to have uploaded; a
 * direct cast would turn "he deleted the last photo in a category" into a
 * build error about types.
 */
export const gallery = manifest as unknown as Gallery
