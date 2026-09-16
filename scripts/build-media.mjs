/**
 * Turns a folder of originals into the renditions the site serves, plus the
 * gallery manifest.
 *
 * This is the build-time twin of the browser pipeline the admin will use in
 * phase 4. Both must produce the same shapes — same widths, same formats,
 * same LQIP — so a photo added through the admin is indistinguishable from
 * one seeded here.
 *
 *   node scripts/build-media.mjs [--src media-src] [--out public/media]
 *
 * Category and order come from the filename: `category-name.jpg`, where the
 * category is one of the four slugs used in code (weddings, lifestyle,
 * events, studio) or their Croatian filename prefixes.
 */
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, parse } from 'node:path'
import sharp from 'sharp'

const WIDTHS = [400, 800, 1200, 1600, 2400]
const args = process.argv.slice(2)
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const SRC = argOf('--src', 'media-src')
const OUT = argOf('--out', 'public/media')

/** Filename prefix -> category id. */
const PREFIX = {
  vjencanje: 'weddings',
  vjencanja: 'weddings',
  lifestyle: 'lifestyle',
  dogadaji: 'events',
  dogadaj: 'events',
  studio: 'studio',
}

/**
 * A 24px-wide blurred JPEG, inlined into the manifest as a data URI.
 *
 * Kept tiny on purpose: it ships inside the manifest on every page load, so
 * a few hundred bytes per photo is the budget. WebP would be smaller still
 * but JPEG decodes everywhere without a format negotiation.
 */
async function lqip(input) {
  const buf = await sharp(input)
    .resize(24, null, { fit: 'inside' })
    .blur(1.2)
    .jpeg({ quality: 40 })
    .toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

async function main() {
  const files = (await readdir(SRC)).filter((f) => /\.(jpe?g|png|tiff?|webp)$/i.test(f)).sort()
  if (files.length === 0) {
    console.error(`No source images in ${SRC}/`)
    process.exit(1)
  }

  const photos = []
  const orderByCategory = new Map()

  for (const file of files) {
    const path = join(SRC, file)
    const { name } = parse(file)
    const prefix = name.split('-')[0]
    const category = PREFIX[prefix]
    if (!category) {
      console.error(`Skipping ${file}: prefix "${prefix}" maps to no category`)
      continue
    }

    const image = sharp(path).rotate() // bake EXIF orientation into pixels
    const meta = await image.metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (!width || !height) {
      console.error(`Skipping ${file}: could not read dimensions`)
      continue
    }

    const id = name
    const dir = join(OUT, 'img', id)
    await mkdir(dir, { recursive: true })

    // Never upscale. A 900px original gets 400 and 800, and the manifest
    // says so — otherwise srcset promises a 2400px file that is just a
    // blurry 900px one reprinted larger.
    const widths = WIDTHS.filter((w) => w <= width)
    if (widths.length === 0) widths.push(width)

    for (const w of widths) {
      const resized = sharp(path).rotate().resize(w, null, { withoutEnlargement: true })
      await Promise.all([
        resized.clone().avif({ quality: 55, effort: 6 }).toFile(join(dir, `${w}.avif`)),
        resized.clone().webp({ quality: 74 }).toFile(join(dir, `${w}.webp`)),
        resized.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(join(dir, `${w}.jpg`)),
      ])
    }

    const order = orderByCategory.get(category) ?? 0
    orderByCategory.set(category, order + 1)

    photos.push({
      id,
      category,
      order,
      width,
      height,
      widths,
      // Placeholder alt: every photo needs a real Croatian description
      // before launch. Kept obvious so it cannot ship unnoticed.
      alt: `TODO opis: ${name.replace(/-/g, ' ')}`,
      lqip: await lqip(path),
    })
    console.log(`${file} -> ${widths.length} widths x 3 formats`)
  }

  // Preserve alt text and pinned flags already written by hand: this script
  // regenerates pixels, it should not undo editorial work.
  const manifestPath = 'app/data/gallery.json'
  let previous = { photos: [] }
  try {
    previous = JSON.parse(await readFile(manifestPath, 'utf8'))
  } catch {
    // First run; nothing to preserve.
  }
  const before = new Map(previous.photos.map((p) => [p.id, p]))
  for (const photo of photos) {
    const old = before.get(photo.id)
    if (old?.alt && !old.alt.startsWith('TODO')) photo.alt = old.alt
    if (old?.pinned) photo.pinned = true
  }

  await mkdir('app/data', { recursive: true })
  await writeFile(
    manifestPath,
    JSON.stringify({ version: (previous.version ?? 0) + 1, updatedAt: new Date().toISOString(), photos }, null, 2) + '\n',
  )
  console.log(`\n${photos.length} photos -> ${manifestPath}`)
}

main()
