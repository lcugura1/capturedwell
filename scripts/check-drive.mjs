/**
 * Confirms the Drive half of the sync works, before any of it is built on.
 *
 *   npm run check:drive
 *
 * Answers four questions that otherwise only surface as an empty gallery
 * three steps later: does the key authenticate, is the root folder actually
 * shared with the service account, are the five subfolders named the way the
 * sync looks them up, and is anything in them a file sharp cannot open.
 *
 * Reads nothing but metadata and writes nothing at all.
 */
import { accessToken } from './lib/google-auth.mjs'
import { DRIVE_SCOPE, FOLDER_TYPE, getFile, listFolder } from './lib/drive.mjs'
import {
  CATEGORY_FOLDERS,
  EXPECTED_FOLDERS,
  MAX_BYTES,
  PAGE_FOLDERS,
  SUPPORTED_TYPES,
} from './lib/gallery-source.mjs'
import { required, serviceAccount } from './lib/env.mjs'

const MB = 1024 * 1024
const problems = []

function heading(text) {
  console.log(`\n${text}`)
}

/**
 * Turn a Drive API error into the one thing to go and fix.
 *
 * The three ways this call fails look alike from here — all 403 or 404 with a
 * wall of JSON — but the fixes are in three different places: the Cloud
 * console, the Drive share dialog, and `.env`. Guessing sends you to the
 * wrong one.
 */
function explain(message, clientEmail) {
  if (message.includes('SERVICE_DISABLED') || message.includes('accessNotConfigured')) {
    const project = message.match(/project=(\d+)/)?.[1]
    return [
      'Google Drive API nije uključen u Cloud projektu (korak A2/3).',
      project
        ? `Uključi ga: https://console.cloud.google.com/apis/library/drive.googleapis.com?project=${project}`
        : 'Uključi ga: APIs & Services → Library → Google Drive API → Enable',
      'Nakon uključivanja treba minutu-dvije da propagira.',
    ]
  }
  if (message.includes('404')) {
    return [
      'Folder nije vidljiv service accountu.',
      `Ili je DRIVE_ROOT_FOLDER_ID pogrešan, ili folder nije podijeljen sa ${clientEmail}.`,
      'Drive vraća 404, ne 403, za nešto što postoji ali nije podijeljeno.',
    ]
  }
  if (message.includes('403')) {
    return [
      `Pristup odbijen. Provjeri da je folder podijeljen sa ${clientEmail} kao Viewer.`,
    ]
  }
  return []
}

async function main() {
  const credentials = await serviceAccount()
  const rootId = required('DRIVE_ROOT_FOLDER_ID')

  heading('1. Prijava')
  const { token, expiresAt } = await accessToken(credentials, DRIVE_SCOPE)
  console.log(`   ✓ ${credentials.client_email}`)
  console.log(`     token vrijedi do ${new Date(expiresAt).toLocaleTimeString('hr-HR')}`)

  heading('2. Root folder')
  let root
  try {
    root = await getFile(token, rootId)
  } catch (error) {
    const reasons = explain(error.message, credentials.client_email)
    console.error('   ✗ Drive nije odgovorio na upit o root folderu.')
    for (const reason of reasons) console.error(`     ${reason}`)
    // The raw body is the only place the real cause appears when it is not one
    // of the three known ones, so keep it — just below the readable answer.
    if (reasons.length === 0) console.error(`     ${error.message}`)
    process.exitCode = 1
    return
  }
  console.log(`   ✓ "${root.name}" je dostupan service accountu`)
  if (root.mimeType !== FOLDER_TYPE) {
    problems.push('DRIVE_ROOT_FOLDER_ID ne pokazuje na folder')
  }

  heading('3. Podfolderi')
  const children = await listFolder(token, rootId)
  const folders = new Map(
    children.filter((f) => f.mimeType === FOLDER_TYPE).map((f) => [f.name, f]),
  )

  for (const name of EXPECTED_FOLDERS) {
    if (folders.has(name)) console.log(`   ✓ ${name}`)
    else {
      console.log(`   ✗ ${name} — nema ga`)
      problems.push(`folder "${name}" ne postoji (ime mora biti točno tako)`)
    }
  }
  for (const name of folders.keys()) {
    if (!EXPECTED_FOLDERS.includes(name)) {
      console.log(`   · ${name} — sync ga ignorira`)
    }
  }
  const loose = children.filter((f) => f.mimeType !== FOLDER_TYPE).length
  if (loose > 0) {
    console.log(`   · ${loose} fotk(a/e) leži izvan podfoldera — sync ih ne vidi`)
  }

  heading('4. Sadržaj')
  const labels = { ...CATEGORY_FOLDERS, ...PAGE_FOLDERS }
  let total = 0

  for (const name of EXPECTED_FOLDERS) {
    const folder = folders.get(name)
    if (!folder) continue

    const files = (await listFolder(token, folder.id)).filter(
      (f) => f.mimeType !== FOLDER_TYPE,
    )
    const usable = files.filter(
      (f) => SUPPORTED_TYPES.has(f.mimeType) && Number(f.size ?? 0) <= MAX_BYTES,
    )
    const missingAlt = usable.filter((f) => !f.description?.trim()).length
    total += usable.length

    const notes = []
    if (missingAlt > 0) notes.push(`${missingAlt} bez opisa`)
    console.log(
      `   ${name.padEnd(10)} → ${labels[name].padEnd(9)} ${String(usable.length).padStart(3)} fotki` +
        (notes.length > 0 ? `  (${notes.join(', ')})` : ''),
    )

    for (const file of files) {
      if (!SUPPORTED_TYPES.has(file.mimeType)) {
        console.log(`     ✗ ${file.name} — ${file.mimeType} se ne može obraditi`)
        problems.push(`${name}/${file.name}: nepodržan format`)
      } else if (Number(file.size ?? 0) > MAX_BYTES) {
        console.log(
          `     ✗ ${file.name} — ${(Number(file.size) / MB).toFixed(0)} MB, previše`,
        )
        problems.push(`${name}/${file.name}: prevelik`)
      }
    }
  }

  heading(`Ukupno ${total} upotrebljivih fotki.`)
  if (problems.length > 0) {
    console.log('\nZa riješiti:')
    for (const problem of problems) console.log(`   • ${problem}`)
    process.exitCode = 1
  } else {
    console.log('Drive strana je spremna.')
  }
}

await main()
