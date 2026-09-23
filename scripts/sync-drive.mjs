/**
 * Drive -> R2. The one thing that turns a folder Damir drops photos into
 * into what the site actually serves.
 *
 *   npm run sync                 # do it
 *   npm run sync -- --dry-run    # say what it would do, write nothing
 *   npm run sync -- --names      # print file names (local only, see below)
 *
 * Runs unattended in CI, so it is built to be re-runnable: the plan is
 * derived from Drive and R2 each time, never from what happened last run, and
 * dying halfway leaves the site serving the previous manifest intact.
 *
 * Writes in an order chosen for that: renditions first, then the manifest
 * that points at them, then the state, and only then the deletions. A crash
 * at any point leaves photos with no manifest entry (invisible, harmless)
 * rather than manifest entries with no photos (broken images on the page).
 */
import { accessToken } from './lib/google-auth.mjs'
import { DRIVE_SCOPE, FOLDER_TYPE, download, listFolder } from './lib/drive.mjs'
import { EXPECTED_FOLDERS } from './lib/gallery-source.mjs'
import { renditions } from './lib/image-pipeline.mjs'
import { r2FromEnv } from './lib/r2.mjs'
import {
  buildManifest,
  buildState,
  planSync,
  sameManifest,
  sourcesFrom,
} from './lib/sync-plan.mjs'
import { required, serviceAccount } from './lib/env.mjs'

const MANIFEST_KEY = 'gallery.json'
const STATE_KEY = 'sync.json'

/** A year, immutable: the id in the key changes whenever the pixels do. */
const RENDITION_CACHE = 'public, max-age=31536000, immutable'
/** Short, because this is the one file whose contents change under its name. */
const MANIFEST_CACHE = 'public, max-age=60'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

/**
 * Whether a file name may be printed.
 *
 * Off by default because this runs in a public repository's Actions log, and
 * Damir's file names are client names — `svadba-ana-i-marko-0041.jpg` in a
 * public log is a privacy leak with no upside. Counts and Drive ids say
 * everything an operator needs; `--names` is for looking at your own terminal.
 */
const NAMES = args.includes('--names')
const label = (source) => (NAMES ? source.name : source.driveId)

function json(value) {
  return new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`)
}

async function main() {
  const credentials = await serviceAccount()
  const rootId = required('DRIVE_ROOT_FOLDER_ID')
  const r2 = r2FromEnv()

  const { token } = await accessToken(credentials, DRIVE_SCOPE)

  // 1. What is on Drive.
  const children = await listFolder(token, rootId)
  const folders = new Map(
    children.filter((f) => f.mimeType === FOLDER_TYPE).map((f) => [f.name, f]),
  )

  const byFolder = {}
  for (const name of EXPECTED_FOLDERS) {
    const folder = folders.get(name)
    if (!folder) {
      console.warn(`! folder "${name}" ne postoji na Driveu — preskačem`)
      continue
    }
    byFolder[name] = (await listFolder(token, folder.id)).filter(
      (f) => f.mimeType !== FOLDER_TYPE,
    )
  }

  const { sources, skipped } = await sourcesFrom(byFolder)
  for (const { folder, file } of skipped) {
    console.warn(
      `! ${folder}: ${NAMES ? file.name : file.id} (${file.mimeType}) se ne može obraditi`,
    )
  }

  // 2. What R2 already has. The manifest as well as the state: renaming a
  //    file or editing its description changes neither its contents nor its
  //    id, so the plan below has nothing to do — and the manifest still has
  //    to be rewritten, because what the site displays did change.
  const [state, published] = await Promise.all([
    r2.getJson(STATE_KEY),
    r2.getJson(MANIFEST_KEY),
  ])
  const plan = planSync(sources, state)

  console.log(
    `Drive: ${sources.length} fotki · za obradu: ${plan.toBuild.length} · za brisanje: ${plan.toRemove.length}`,
  )

  if (DRY_RUN) {
    for (const source of plan.toBuild)
      console.log(`  + ${source.category ?? source.page} ${label(source)}`)
    for (const { id, kind } of plan.toRemove) console.log(`  - ${kind}/${id}/`)
    console.log('\n--dry-run: ništa nije zapisano.')
    return
  }

  // 3. Build and upload the new renditions. A no-op when there is nothing
  //    new; the manifest below is what decides whether this run does work. Sequential on purpose: a 24MP
  //    original expands to well over a gigabyte across five widths and three
  //    formats, and a CI runner has 7 GB for everything.
  const built = {}
  for (const [i, source] of plan.toBuild.entries()) {
    const bytes = await download(token, source.driveId)
    const result = await renditions(bytes)
    if (!result) {
      console.warn(`! ${label(source)}: sharp ne može pročitati dimenzije — preskačem`)
      continue
    }

    for (const file of result.files) {
      await r2.put(`${source.kind}/${source.id}/${file.name}`, file.body, {
        contentType: file.contentType,
        cacheControl: RENDITION_CACHE,
      })
    }

    built[source.id] = {
      width: result.width,
      height: result.height,
      widths: result.widths,
      lqip: result.lqip,
    }
    console.log(
      `  ${String(i + 1).padStart(3)}/${plan.toBuild.length} ${source.category ?? source.page} ` +
        `${result.width}x${result.height} -> ${result.widths.length} širina × 3 formata`,
    )
  }

  // 4. The manifest, projected from Drive plus every rendition we know of —
  //    the ones just built, and the ones a previous run recorded.
  const known = Object.fromEntries(
    Object.entries(state?.photos ?? {}).map(([id, p]) => [id, p]),
  )
  const all = { ...known, ...built }

  const manifest = buildManifest(sources, all, {
    version: (state?.manifestVersion ?? 0) + 1,
  })

  if (
    plan.toBuild.length === 0 &&
    plan.toRemove.length === 0 &&
    sameManifest(manifest, published)
  ) {
    console.log('Nema promjena.')
    return
  }
  await r2.put(MANIFEST_KEY, json(manifest), {
    contentType: 'application/json',
    cacheControl: MANIFEST_CACHE,
  })

  // 5. State, so the next run knows what not to redo.
  const next = buildState(sources, all)
  next.manifestVersion = manifest.version
  await r2.put(STATE_KEY, json(next), { contentType: 'application/json' })

  // 6. Only now the deletions. Listing the prefix rather than deriving keys
  //    from the recorded widths: if an earlier run died between uploading and
  //    writing state, the state is the one thing that does not know what is
  //    up there.
  for (const { id, kind } of plan.toRemove) {
    const keys = await r2.list(`${kind}/${id}/`)
    for (const key of keys) await r2.delete(key)
    console.log(`  - ${kind}/${id}/ (${keys.length} fajlova)`)
  }

  console.log(
    `\ngallery.json v${manifest.version}: ${manifest.photos.length} fotki, ` +
      `${Object.keys(manifest.pages).length} slika stranice`,
  )

  // A skipped file is not a failure — the rest of the sync is sound — but it
  // must not pass unnoticed either, or a photo Damir added is simply missing.
  // A non-zero exit makes GitHub mail the run as failed.
  if (skipped.length > 0) {
    console.warn(`\n${skipped.length} fotk(a/e) preskočeno — vidi upozorenja gore.`)
    process.exitCode = 1
  }
}

await main()
