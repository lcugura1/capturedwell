/**
 * The slice of the Drive API the sync uses: list a folder, fetch a file.
 *
 * Read-only by design. The service account is a Viewer on one shared folder,
 * so there is nothing here that could write to Damir's Drive even by mistake.
 */

const FILES = 'https://www.googleapis.com/drive/v3/files'

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
export const FOLDER_TYPE = 'application/vnd.google-apps.folder'

/**
 * Everything the sync needs to know about a file.
 *
 * `md5Checksum` is half of the photo id, so replacing a file's contents
 * produces new URLs and the immutable cache stays correct. `description` is
 * the Drive "Description" field, which is where the Croatian alt text lives.
 */
const FIELDS = 'id,name,mimeType,md5Checksum,createdTime,description,size'

/** Drive's query language takes single-quoted strings and has no escape. */
function quote(value) {
  return `'${String(value).replace(/'/g, "\\'")}'`
}

async function request(token, params) {
  const url = new URL(FILES)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok)
    throw new Error(`Drive API ${res.status} on ${url.pathname}: ${await res.text()}`)
  return res.json()
}

/**
 * Direct children of a folder, trashed items excluded.
 *
 * Follows `nextPageToken`: a category folder will outgrow one page long
 * before the R2 free tier runs out, and a silently truncated listing would
 * read as "Damir deleted 900 photos" to the diff.
 */
export async function listFolder(token, folderId) {
  const files = []
  let pageToken

  do {
    const page = await request(token, {
      q: `${quote(folderId)} in parents and trashed = false`,
      fields: `nextPageToken,files(${FIELDS})`,
      pageSize: '1000',
      // Harmless on My Drive, and covers a move to a shared drive later.
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      ...(pageToken ? { pageToken } : {}),
    })
    files.push(...page.files)
    pageToken = page.nextPageToken
  } while (pageToken)

  return files
}

/** One named subfolder, or `undefined`. Names are matched exactly. */
export async function findSubfolder(token, parentId, name) {
  const { files } = await request(token, {
    q: `${quote(parentId)} in parents and name = ${quote(name)} and mimeType = ${quote(FOLDER_TYPE)} and trashed = false`,
    fields: `files(${FIELDS})`,
    pageSize: '2',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  })
  return files[0]
}

/** Metadata for a single file — used to confirm the root folder is reachable. */
export async function getFile(token, fileId) {
  const url = new URL(`${FILES}/${fileId}`)
  url.searchParams.set('fields', FIELDS)
  url.searchParams.set('supportsAllDrives', 'true')

  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok)
    throw new Error(`Drive API ${res.status} for file ${fileId}: ${await res.text()}`)
  return res.json()
}

/** Raw bytes of a file. */
export async function download(token, fileId) {
  const url = new URL(`${FILES}/${fileId}`)
  url.searchParams.set('alt', 'media')
  url.searchParams.set('supportsAllDrives', 'true')

  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok)
    throw new Error(
      `Drive download ${res.status} for file ${fileId}: ${await res.text()}`,
    )
  return new Uint8Array(await res.arrayBuffer())
}
