/**
 * Every five minutes: has anything changed on Drive? If so, start the sync
 * workflow on GitHub. Nothing else.
 *
 * Exists because GitHub switches off scheduled workflows in a public
 * repository after 60 days without a commit, and a portfolio that works is
 * exactly a repository nobody commits to. The workflow keeps a daily schedule
 * of its own as a fallback for this Worker, not the other way round.
 *
 * Deliberately no `fetch()` handler. There is no URL to call, so there is
 * nothing to attack and nothing to authenticate.
 *
 * The decision is `pendingChanges()` — the same function the sync calls
 * before it writes anything — over the same Drive listing, so a run this
 * starts always finds the work it was started for. The Worker reads R2
 * through its binding and never writes; the workflow is the only writer.
 *
 * Logs counts, never file names: the names are Damir's clients' names.
 */
import { accessToken } from '../../../scripts/lib/google-auth.mjs'
import { DRIVE_SCOPE } from '../../../scripts/lib/drive.mjs'
import { readDrive } from '../../../scripts/lib/drive-sources.mjs'
import { dispatch, isRunning } from '../../../scripts/lib/github.mjs'
import { pendingChanges } from '../../../scripts/lib/sync-plan.mjs'

async function readJson(bucket, key) {
  const object = await bucket.get(key)
  return object ? object.json() : null
}

async function check(env) {
  const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const { token } = await accessToken(credentials, DRIVE_SCOPE)

  const [{ sources }, state, published] = await Promise.all([
    readDrive(token, env.DRIVE_ROOT_FOLDER_ID),
    readJson(env.MEDIA, 'sync.json'),
    readJson(env.MEDIA, 'gallery.json'),
  ])

  const plan = pendingChanges(sources, state, published)
  const counts = `Drive: ${sources.length} · nove: ${plan.toBuild.length} · maknute: ${plan.toRemove.length}`
  if (!plan.changed) {
    console.log(`${counts} · bez promjena`)
    return
  }

  if (await isRunning(env.GITHUB_TOKEN, env.GITHUB_REPO, env.GITHUB_WORKFLOW)) {
    // The running sync may have listed Drive before this change. If so, the
    // next tick after it finishes sees the difference and starts another.
    console.log(`${counts} · sync već radi, čekam`)
    return
  }

  await dispatch(env.GITHUB_TOKEN, env.GITHUB_REPO, env.GITHUB_WORKFLOW, env.GITHUB_REF)
  console.log(`${counts} · pokrenut ${env.GITHUB_WORKFLOW} na ${env.GITHUB_REF}`)
}

export default {
  async scheduled(_controller, env, ctx) {
    // Thrown, not caught: a failed invocation is marked as such in the
    // dashboard's Cron Events, which is where an expired token shows up.
    ctx.waitUntil(check(env))
  },
}
