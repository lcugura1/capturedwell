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
import { appendFile } from 'node:fs/promises'
import { accessToken } from './lib/google-auth.mjs'
import { DRIVE_SCOPE, download } from './lib/drive.mjs'
import { readDrive } from './lib/drive-sources.mjs'
import { renditions } from './lib/image-pipeline.mjs'
import { r2FromEnv } from './lib/r2.mjs'
import { buildManifest, buildState, pendingChanges } from './lib/sync-plan.mjs'
import { required, serviceAccount } from './lib/env.mjs'

const MANIFEST_KEY = 'gallery.json'
const STATE_KEY = 'sync.json'

/** A year, immutable: the id in the key changes whenever the pixels do. */
const RENDITION_CACHE = 'public, max-age=31536000, immutable'
/** Short, because this is the one file whose contents change under its name. */
const MANIFEST_CACHE = 'public, max-age=60'

/**
 * Reviews Damir approved, from the private reviews bucket.
 *
 * `null` when the bucket is not configured — a local run without the
 * variable — and then the published reviews are carried over untouched
 * rather than read as "there are none", which would unpublish them all.
 *
 * Only the manifest's fields are copied: the objects were written by the
 * site's Worker after it validated them, but what reaches the page should be
 * decided here, not by whatever else a file in the bucket might hold.
 */
async function approvedReviews() {
  const bucket = process.env.R2_REVIEWS_BUCKET
  if (!bucket) return null
  const store = r2FromEnv({ ...process.env, R2_BUCKET: bucket })
  const keys = (await store.list('approved/')).filter((key) => key.endsWith('.json'))
  const approved = await Promise.all(keys.map((key) => store.getJson(key)))
  return approved
    .filter(Boolean)
    .map(({ id, name, text, addedAt }) => ({ id, name, text, addedAt }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

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

/**
 * Step outputs for the workflow: whether to build and deploy, and how many
 * files were skipped. A no-op outside GitHub Actions.
 */
async function output(values) {
  const path = process.env.GITHUB_OUTPUT
  if (!path) return
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}\n`)
  await appendFile(path, lines.join(''))
}

async function main() {
  const credentials = await serviceAccount()
  const rootId = required('DRIVE_ROOT_FOLDER_ID')
  const r2 = r2FromEnv()

  const { token } = await accessToken(credentials, DRIVE_SCOPE)

  // 1. What is on Drive.
  const { sources, skipped, missing } = await readDrive(token, rootId)
  for (const name of missing)
    console.warn(`! folder "${name}" ne postoji na Driveu — preskačem`)
  for (const { folder, file } of skipped) {
    console.warn(
      `! ${folder}: ${NAMES ? file.name : file.id} (${file.mimeType}) se ne može obraditi`,
    )
  }

  // 2. What R2 already has, and whether Drive says anything different. The
  //    cron Worker asks the same question with the same function, so a run it
  //    starts always finds the work it saw.
  const [state, published] = await Promise.all([
    r2.getJson(STATE_KEY),
    r2.getJson(MANIFEST_KEY),
  ])
  const plan = pendingChanges(sources, state, published)
  const reviews = (await approvedReviews()) ?? published?.reviews ?? []
  const reviewsChanged =
    JSON.stringify(reviews) !== JSON.stringify(published?.reviews ?? [])
  const changed = plan.changed || reviewsChanged
  const stuck = new Set(state?.unreadable ?? [])
  const unreadableOnDrive = sources.filter((s) => stuck.has(s.id))
  for (const source of unreadableOnDrive)
    console.warn(`! ${label(source)}: ranije nečitljiva — zamijeni fajl na Driveu`)

  console.log(
    `Drive: ${sources.length} fotki · za obradu: ${plan.toBuild.length} · za brisanje: ${plan.toRemove.length}` +
      ` · recenzija: ${reviews.length}${reviewsChanged ? ' (promijenjeno)' : ''}`,
  )

  if (DRY_RUN) {
    for (const source of plan.toBuild)
      console.log(`  + ${source.category ?? source.page} ${label(source)}`)
    for (const { id, kind } of plan.toRemove) console.log(`  - ${kind}/${id}/`)
    console.log(changed ? '  ~ gallery.json' : 'Nema promjena.')
    console.log('\n--dry-run: ništa nije zapisano.')
    return
  }

  if (!changed) {
    console.log('Nema promjena.')
    await report(skipped.length + unreadableOnDrive.length, false)
    return
  }

  // 3. Build and upload the new renditions. A no-op when only the manifest
  //    changed (a rename, a description). Sequential on purpose: a 24MP
  //    original expands to well over a gigabyte across five widths and three
  //    formats, and a CI runner has 7 GB for everything.
  const built = {}
  const unreadable = [...stuck]
  for (const [i, source] of plan.toBuild.entries()) {
    const bytes = await download(token, source.driveId)
    const result = await renditions(bytes)
    if (!result) {
      console.warn(`! ${label(source)}: sharp ne može pročitati dimenzije — preskačem`)
      unreadable.push(source.id)
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

  const manifest = {
    ...buildManifest(sources, all, { version: (state?.manifestVersion ?? 0) + 1 }),
    reviews,
  }

  await r2.put(MANIFEST_KEY, json(manifest), {
    contentType: 'application/json',
    cacheControl: MANIFEST_CACHE,
  })

  // 5. State, so the next run knows what not to redo.
  const next = buildState(sources, all, { unreadable })
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
      `${Object.keys(manifest.pages).length} slika stranice, ${reviews.length} recenzija`,
  )

  await report(skipped.length + (next.unreadable?.length ?? 0), true)
}

/**
 * A skipped file is not a failure — the rest of the sync is sound — but it
 * must not pass unnoticed either, or a photo Damir added is simply missing.
 * Counted on every run, not only the first, so it keeps being reported until
 * the file is replaced.
 *
 * Locally that is a non-zero exit. In Actions it is an output instead: the
 * workflow still has to build and deploy the photos that did work, and fails
 * its last step afterwards, which is what makes GitHub mail the run.
 */
async function report(failed, changed) {
  await output({ changed, skipped: failed })
  if (failed === 0) return
  console.warn(`\n${failed} fotk(a/e) preskočeno — Drive id-evi u upozorenjima iznad.`)
  if (!process.env.GITHUB_OUTPUT) process.exitCode = 1
}

await main()
