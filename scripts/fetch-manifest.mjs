/**
 * Brings the gallery manifest down from R2 so the build can import it.
 *
 *   npm run manifest
 *
 * Runs before `dev` and `build`. The manifest used to be committed and
 * regenerated from `media-src/`; it now lives in the bucket, written by
 * `sync-drive.mjs`, and the repository holds no photographs at all.
 *
 * Always leaves a readable file behind. `app/lib/gallery.ts` imports it, so
 * an absent file is not a warning but a build that cannot start — and a
 * network hiccup is a bad reason to be unable to work on the site.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const BASE = process.env.VITE_MEDIA_BASE ?? 'https://img.capturedwell.com'
const OUT = 'app/data/gallery.json'

/** Matches EMPTY_GALLERY in app/lib/gallery-types.ts. */
const EMPTY = { version: 0, updatedAt: new Date(0).toISOString(), photos: [], pages: {} }

async function existing() {
  try {
    return JSON.parse(await readFile(OUT, 'utf8'))
  } catch {
    return null
  }
}

async function main() {
  const url = `${BASE}/gallery.json`
  let manifest

  try {
    const res = await fetch(url, { headers: { 'cache-control': 'no-cache' } })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    manifest = await res.json()
    console.log(
      `gallery.json v${manifest.version}: ${manifest.photos.length} fotki, ` +
        `${Object.keys(manifest.pages ?? {}).length} slika stranice`,
    )
  } catch (error) {
    const local = await existing()
    if (local) {
      // Offline, or the bucket is briefly unreachable. The copy on disk is a
      // previous run's manifest, which is wrong only if Damir has uploaded
      // since — a far better failure than not building.
      console.warn(`! ${url} nedostupan (${error.message}) — koristim postojeći ${OUT}`)
      return
    }
    console.warn(`! ${url} nedostupan (${error.message}) i nema lokalne kopije.`)
    console.warn(
      '  Stranica se gradi bez fotografija. Pokreni `npm run sync` kad budeš na mreži.',
    )
    manifest = EMPTY
  }

  await mkdir('app/data', { recursive: true })
  await writeFile(OUT, `${JSON.stringify(manifest, null, 2)}\n`)
}

await main()
