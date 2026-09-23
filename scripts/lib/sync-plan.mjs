/**
 * What the sync should do, worked out without touching Drive, R2 or disk.
 *
 * Everything here is a pure function of a Drive listing and the last known
 * state. That is deliberate: this is the part that decides what gets deleted,
 * and a wrong answer costs Damir his photographs. Pure means it can be tested
 * exhaustively, which `sync-drive.mjs` — all network and pixels — cannot.
 */
import {
  CATEGORY_FOLDERS,
  CATEGORY_NAMES,
  MAX_BYTES,
  PAGE_ALT,
  PAGE_FOLDERS,
  SUPPORTED_TYPES,
} from './gallery-source.mjs'

const utf8 = new TextEncoder()

/**
 * A photo's id: the Drive file it came from, plus the bytes it contained.
 *
 * Folding the checksum in is what makes `immutable` caching safe. Replace a
 * file's contents on Drive and the id changes, so the URLs change, so no CDN
 * or browser anywhere is holding the old pixels under the new name. The cost
 * is that an edited photo is uploaded afresh rather than overwritten — the
 * right trade when the alternative is a cache purge that may not reach
 * everyone.
 */
export async function photoId(driveId, md5) {
  const digest = await crypto.subtle.digest('SHA-256', utf8.encode(`${driveId}:${md5}`))
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 12)
}

/**
 * Alt text for a photo whose Drive description is empty.
 *
 * Numbered by age, oldest first, so adding a photo does not renumber the ones
 * already on the site. Honest rather than helpful: it says what the photo is
 * a photo of only as far as the category goes, which is why the real
 * description is worth Damir's time.
 */
export function fallbackAlt(category, index) {
  return `${CATEGORY_NAMES[category] ?? category} — fotografija ${index}`
}

/**
 * A leading number in the file name, used to order a category by hand.
 *
 *   `03 - prvi ples.jpg` -> 3        `@capturedwell_-73.jpg` -> null
 *   `02.jpg`             -> 2        `Image 15.09.2026. at 23.21.PNG` -> null
 *
 * The one lever Damir has over order that a folder can give him. Drive
 * timestamps a whole batch upload to the same minute, so `addedAt` cannot
 * separate photos he added together — renaming can.
 *
 * Deliberately narrow. At most three digits, and the number has to end the
 * name or be followed by a separator, so `2026 vjencanje.jpg` stays unranked
 * rather than leaping to the front of the category as rank 2026.
 */
const RANK = /^(\d{1,3})(?:\s*[-–—_.)]\s*|\s+|$)/

export function rankOf(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '')
  const match = RANK.exec(base)
  return match ? Number(match[1]) : null
}

/** Files sharp cannot open, and files too large to be a photograph. */
export function isUsable(file) {
  return SUPPORTED_TYPES.has(file.mimeType) && Number(file.size ?? 0) <= MAX_BYTES
}

/**
 * Flatten `{folderName: files[]}` into one list, each entry knowing where on
 * the site it belongs. Unusable files are dropped here and reported by the
 * caller, so nothing downstream has to keep checking.
 */
export async function sourcesFrom(byFolder) {
  const sources = []
  const skipped = []

  for (const [folder, files] of Object.entries(byFolder)) {
    const category = CATEGORY_FOLDERS[folder]
    const page = PAGE_FOLDERS[folder]
    if (!category && !page) continue

    for (const file of files) {
      if (!isUsable(file)) {
        skipped.push({ folder, file })
        continue
      }
      sources.push({
        id: await photoId(file.id, file.md5Checksum ?? ''),
        driveId: file.id,
        md5: file.md5Checksum ?? '',
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        description: file.description?.trim() ?? '',
        rank: rankOf(file.name),
        kind: category ? 'img' : 'page',
        category: category ?? null,
        page: page ?? null,
      })
    }
  }

  return { sources, skipped }
}

/**
 * Which photos need their pixels built, and which renditions are now orphans.
 *
 * Both answers fall out of one comparison: the id a photo should have, and
 * the prefix it should sit under. A new file and an edited file alike have an
 * id nothing has seen; the id an edited file used to have is simply absent.
 * There is no separate "changed" case to get wrong.
 *
 * The prefix has to be part of it, not just the id. Drag a photo from
 * `vjencanja` into `naslovna` and Drive keeps the same file and the same
 * checksum, so the id does not move — but the renditions belong under
 * `page/` now and exist only under `img/`. Comparing ids alone declared
 * there was nothing to do and left the cover pointing at a 404.
 */
export function planSync(sources, state) {
  const known = state?.photos ?? {}
  const unreadable = new Set(state?.unreadable ?? [])
  const wanted = new Map(sources.map((s) => [s.id, s.kind]))
  const kindOf = (entry) => entry.kind ?? 'img'

  return {
    toBuild: sources.filter(
      (s) =>
        !unreadable.has(s.id) && (!known[s.id] || kindOf(known[s.id]) !== s.kind),
    ),
    toRemove: Object.entries(known)
      .filter(([id, entry]) => wanted.get(id) !== kindOf(entry))
      .map(([id, entry]) => ({ id, kind: kindOf(entry) })),
  }
}

/**
 * The manifest the site reads, projected from the Drive listing and the
 * dimensions recorded per id.
 *
 * Rebuilt in full every run rather than patched. A description edited on
 * Drive then costs nothing — no download, no re-encode, just a new manifest —
 * and the manifest can never drift from what Drive actually holds.
 */
export function buildManifest(
  sources,
  renditions,
  { version = 1, now = new Date() } = {},
) {
  const photos = []

  for (const category of new Set(
    sources.filter((s) => s.category).map((s) => s.category),
  )) {
    const inCategory = sources
      .filter((s) => s.category === category)
      // Oldest first only to number the fallback alt texts stably; the site
      // sorts newest-first itself, from `addedAt`.
      .sort((a, b) => a.createdTime.localeCompare(b.createdTime))

    inCategory.forEach((source, i) => {
      const rendition = renditions[source.id]
      if (!rendition) return
      photos.push({
        id: source.id,
        category,
        addedAt: source.createdTime,
        width: rendition.width,
        height: rendition.height,
        widths: rendition.widths,
        alt: source.description || fallbackAlt(category, i + 1),
        lqip: rendition.lqip,
        // Omitted rather than null when absent: the manifest ships in the
        // HTML of every page load, and `"rank":null` on two hundred photos
        // is bytes for nothing.
        ...(source.rank === null ? {} : { rank: source.rank }),
      })
    })
  }

  // One image per page slot; the most recently added wins, so replacing the
  // cover or the About portrait is a matter of dropping a new one in.
  const pages = {}
  for (const source of sources.filter((s) => s.page)) {
    const rendition = renditions[source.id]
    if (!rendition) continue
    const current = pages[source.page]
    if (!current || source.createdTime > current.addedAt) {
      pages[source.page] = {
        id: source.id,
        addedAt: source.createdTime,
        width: rendition.width,
        height: rendition.height,
        widths: rendition.widths,
        alt: source.description || PAGE_ALT[source.page] || '',
        lqip: rendition.lqip,
      }
    }
  }

  return { version, updatedAt: now.toISOString(), photos, pages }
}

/**
 * State for the next run: enough to rebuild the manifest without pixels.
 *
 * `unreadable` lists ids sharp could not decode. Without it such a photo
 * stays in `toBuild` forever, and the cron Worker — which asks exactly that
 * question every five minutes — would start a workflow every five minutes
 * to fail on it again. The id carries the checksum, so a replaced file gets
 * a new id and is tried afresh.
 */
export function buildState(
  sources,
  renditions,
  { now = new Date(), unreadable = [] } = {},
) {
  const photos = {}
  for (const source of sources) {
    const rendition = renditions[source.id]
    if (!rendition) continue
    photos[source.id] = {
      driveId: source.driveId,
      md5: source.md5,
      kind: source.kind,
      width: rendition.width,
      height: rendition.height,
      widths: rendition.widths,
      lqip: rendition.lqip,
    }
  }
  // Only ids still on Drive, so the list cannot outgrow what is there.
  const present = new Set(sources.map((s) => s.id))
  const stuck = [...new Set(unreadable)].filter((id) => present.has(id))
  return {
    version: 1,
    updatedAt: now.toISOString(),
    photos,
    ...(stuck.length > 0 ? { unreadable: stuck } : {}),
  }
}

/**
 * Whether two manifests say the same thing about the photographs.
 *
 * `version` and `updatedAt` change on every write by definition, so
 * comparing whole objects would always report a difference and the sync
 * would republish the manifest on every run. What matters is the content:
 * rename a file on Drive and this says they differ; run the sync twice with
 * nothing touched and it says they match.
 */
export function sameManifest(a, b) {
  if (!a || !b) return false
  const content = (m) => JSON.stringify({ photos: m.photos, pages: m.pages })
  return content(a) === content(b)
}

/**
 * Whether Drive says something the published site does not.
 *
 * The one question the cron Worker asks every five minutes, and the question
 * `sync-drive.mjs` answers before it writes anything. Both call this, so the
 * Worker can never start a workflow that then finds nothing to do, nor sit
 * quietly on a change the workflow would have published.
 *
 * Pixels are one half of it; the other is a manifest that reads differently
 * with nothing to rebuild — a rename that reorders a category, an edited
 * description. Projected from the renditions `state` already records, which
 * is all the manifest is ever made of when nothing is new.
 */
export function pendingChanges(sources, state, published) {
  const plan = planSync(sources, state)
  const pixels = plan.toBuild.length > 0 || plan.toRemove.length > 0
  const manifest = buildManifest(sources, state?.photos ?? {})

  return {
    ...plan,
    changed: pixels || !sameManifest(manifest, published),
  }
}
