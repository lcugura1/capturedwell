/**
 * The two GitHub calls the cron Worker makes: is a sync already running, and
 * start one.
 *
 * The token is a fine-grained PAT limited to this repository with Actions
 * read & write and nothing else (docs/plan-drive-sync.md, A4/9) — enough to
 * start a workflow, not enough to change what the workflow runs.
 */

const API = 'https://api.github.com'

/** Statuses of a run that has not finished yet. */
const UNFINISHED = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested'])

function headers(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
    // GitHub rejects requests without one; Workers do not send a default.
    'user-agent': 'capturedwell-sync-trigger',
  }
}

async function check(res, what) {
  if (res.ok) return
  const hint =
    res.status === 401
      ? ' — GITHUB_TOKEN je istekao ili je opozvan (plan A4/9)'
      : res.status === 404
        ? ' — token nema pristup repozitoriju, ili workflow ne postoji na zadanoj grani'
        : ''
  throw new Error(`GitHub ${what}: ${res.status}${hint}. ${await res.text()}`)
}

/**
 * Whether a run of the workflow is queued or in progress.
 *
 * Checked before dispatching because a sync takes a few minutes and the cron
 * fires every five: without it, a large upload would queue a second run that
 * GitHub then cancels in favour of a third. Harmless, but it fills the
 * Actions tab with cancelled runs that look like failures.
 */
export async function isRunning(token, repo, workflow) {
  const url = `${API}/repos/${repo}/actions/workflows/${workflow}/runs?per_page=5`
  const res = await fetch(url, { headers: headers(token) })
  await check(res, 'runs')
  const { workflow_runs: runs } = await res.json()
  return runs.some((run) => UNFINISHED.has(run.status))
}

/** Start the workflow on `ref`. It must exist on that branch. */
export async function dispatch(token, repo, workflow, ref) {
  const url = `${API}/repos/${repo}/actions/workflows/${workflow}/dispatches`
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...headers(token), 'content-type': 'application/json' },
    body: JSON.stringify({ ref }),
  })
  await check(res, 'dispatch')
}
