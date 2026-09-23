/**
 * Everything on Drive that the site could show, as sync sources.
 *
 * Shared by the sync and the cron Worker, which must see Drive identically:
 * if they listed it differently, the Worker would trigger runs that find
 * nothing to do, or miss changes the sync would have published.
 *
 * Web-platform only, like the modules it builds on, so it bundles into the
 * Worker unchanged.
 */
import { FOLDER_TYPE, listFolder } from './drive.mjs'
import { EXPECTED_FOLDERS } from './gallery-source.mjs'
import { sourcesFrom } from './sync-plan.mjs'

/**
 * One listing of the root, one per expected subfolder.
 *
 * `missing` names folders that are not there. Not an error — the site simply
 * has nothing from them — but worth saying, since a renamed folder looks
 * exactly like an emptied one to everything downstream.
 */
export async function readDrive(token, rootId) {
  const children = await listFolder(token, rootId)
  const folders = new Map(
    children.filter((f) => f.mimeType === FOLDER_TYPE).map((f) => [f.name, f]),
  )

  const byFolder = {}
  const missing = []
  for (const name of EXPECTED_FOLDERS) {
    const folder = folders.get(name)
    if (!folder) {
      missing.push(name)
      continue
    }
    byFolder[name] = (await listFolder(token, folder.id)).filter(
      (f) => f.mimeType !== FOLDER_TYPE,
    )
  }

  return { ...(await sourcesFrom(byFolder)), missing }
}
