import { describe, expect, it } from 'vitest'
import {
  buildManifest,
  buildState,
  fallbackAlt,
  isUsable,
  pendingChanges,
  photoId,
  planSync,
  rankOf,
  sameManifest,
  sourcesFrom,
} from './sync-plan.mjs'

const file = (over = {}) => ({
  id: 'drive-1',
  name: 'foto.jpg',
  mimeType: 'image/jpeg',
  md5Checksum: 'abc123',
  createdTime: '2026-09-01T10:00:00.000Z',
  size: '2000000',
  ...over,
})

const rendition = (over = {}) => ({
  width: 4000,
  height: 3000,
  widths: [400, 800, 1200, 1600, 2400],
  lqip: 'data:image/jpeg;base64,xxx',
  ...over,
})

describe('photoId', () => {
  it('is stable for the same file and contents', async () => {
    expect(await photoId('drive-1', 'abc')).toBe(await photoId('drive-1', 'abc'))
  })

  it('changes when the contents change', async () => {
    expect(await photoId('drive-1', 'abc')).not.toBe(await photoId('drive-1', 'def'))
  })

  it('changes when the same bytes are re-uploaded as a new file', async () => {
    expect(await photoId('drive-1', 'abc')).not.toBe(await photoId('drive-2', 'abc'))
  })

  it('is 12 hex characters, so it is safe in a URL', async () => {
    expect(await photoId('drive-1', 'abc')).toMatch(/^[0-9a-f]{12}$/)
  })
})

describe('isUsable', () => {
  it('accepts a JPEG', () => {
    expect(isUsable(file())).toBe(true)
  })

  it('rejects HEIC, which sharp cannot decode', () => {
    expect(isUsable(file({ mimeType: 'image/heic' }))).toBe(false)
  })

  it('rejects a file past the size ceiling', () => {
    expect(isUsable(file({ size: String(200 * 1024 * 1024) }))).toBe(false)
  })
})

describe('sourcesFrom', () => {
  it('maps a folder name to its category and keeps the description', async () => {
    const { sources } = await sourcesFrom({
      vjencanja: [file({ description: '  Ana i Marko  ' })],
    })
    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({
      category: 'weddings',
      kind: 'img',
      description: 'Ana i Marko',
    })
  })

  it('treats o-meni as a page image, not a category', async () => {
    const { sources } = await sourcesFrom({ 'o-meni': [file()] })
    expect(sources[0]).toMatchObject({ kind: 'page', page: 'about', category: null })
  })

  it('reports unusable files instead of dropping them silently', async () => {
    const { sources, skipped } = await sourcesFrom({
      eventi: [file({ id: 'a' }), file({ id: 'b', mimeType: 'image/heic' })],
    })
    expect(sources).toHaveLength(1)
    expect(skipped).toHaveLength(1)
    expect(skipped[0].file.id).toBe('b')
  })

  it('ignores folders the site knows nothing about', async () => {
    const { sources } = await sourcesFrom({ nesto: [file()] })
    expect(sources).toEqual([])
  })
})

describe('planSync', () => {
  it('builds everything on a first run', async () => {
    const { sources } = await sourcesFrom({ lifestyle: [file()] })
    const plan = planSync(sources, null)
    expect(plan.toBuild).toHaveLength(1)
    expect(plan.toRemove).toEqual([])
  })

  it('builds nothing when Drive has not changed', async () => {
    const { sources } = await sourcesFrom({ lifestyle: [file()] })
    const state = buildState(sources, { [sources[0].id]: rendition() })
    expect(planSync(sources, state).toBuild).toEqual([])
  })

  it('rebuilds an edited photo and orphans the id it used to have', async () => {
    const before = await sourcesFrom({ lifestyle: [file({ md5Checksum: 'old' })] })
    const state = buildState(before.sources, { [before.sources[0].id]: rendition() })

    const after = await sourcesFrom({ lifestyle: [file({ md5Checksum: 'new' })] })
    const plan = planSync(after.sources, state)

    expect(plan.toBuild.map((s) => s.id)).toEqual([after.sources[0].id])
    expect(plan.toRemove).toEqual([{ id: before.sources[0].id, kind: 'img' }])
  })

  it('removes a photo deleted from Drive', async () => {
    const { sources } = await sourcesFrom({ lifestyle: [file()] })
    const state = buildState(sources, { [sources[0].id]: rendition() })
    const plan = planSync([], state)
    expect(plan.toRemove).toEqual([{ id: sources[0].id, kind: 'img' }])
  })

  it('rebuilds under the new prefix when a photo moves from a category to a page', async () => {
    // Same Drive file, same bytes, so the id does not change — but the
    // renditions now belong under page/ and exist only under img/.
    const before = await sourcesFrom({ vjencanja: [file()] })
    const state = buildState(before.sources, { [before.sources[0].id]: rendition() })

    const after = await sourcesFrom({ naslovna: [file()] })
    const plan = planSync(after.sources, state)

    expect(plan.toBuild.map((s) => s.id)).toEqual([after.sources[0].id])
    expect(plan.toRemove).toEqual([{ id: before.sources[0].id, kind: 'img' }])
  })

  it('leaves a photo alone when it moves between two categories', async () => {
    // Both are img/, so the same files serve the new category and only the
    // manifest changes.
    const before = await sourcesFrom({ vjencanja: [file()] })
    const state = buildState(before.sources, { [before.sources[0].id]: rendition() })

    const after = await sourcesFrom({ lifestyle: [file()] })
    const plan = planSync(after.sources, state)

    expect(plan.toBuild).toEqual([])
    expect(plan.toRemove).toEqual([])
  })

  it('does not rebuild pixels when only the description changed', async () => {
    const before = await sourcesFrom({ lifestyle: [file({ description: '' })] })
    const state = buildState(before.sources, { [before.sources[0].id]: rendition() })

    const after = await sourcesFrom({ lifestyle: [file({ description: 'Bazen' })] })
    const plan = planSync(after.sources, state)

    expect(plan.toBuild).toEqual([])
    expect(plan.toRemove).toEqual([])
  })
})

describe('buildManifest', () => {
  const threeWeddings = () =>
    sourcesFrom({
      vjencanja: [
        file({ id: 'a', md5Checksum: '1', createdTime: '2026-01-01T00:00:00.000Z' }),
        file({ id: 'b', md5Checksum: '2', createdTime: '2026-03-01T00:00:00.000Z' }),
        file({ id: 'c', md5Checksum: '3', createdTime: '2026-02-01T00:00:00.000Z' }),
      ],
    })

  it('carries createdTime through as addedAt', async () => {
    const { sources } = await threeWeddings()
    const renditions = Object.fromEntries(sources.map((s) => [s.id, rendition()]))
    const manifest = buildManifest(sources, renditions)
    expect(manifest.photos.map((p) => p.addedAt)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
    ])
  })

  it('numbers fallback alt text by age, so a new photo renumbers nothing', async () => {
    const { sources } = await threeWeddings()
    const renditions = Object.fromEntries(sources.map((s) => [s.id, rendition()]))
    const manifest = buildManifest(sources, renditions)
    const byDate = [...manifest.photos].sort((x, y) => x.addedAt.localeCompare(y.addedAt))
    expect(byDate.map((p) => p.alt)).toEqual([
      'vjenčanja — fotografija 1',
      'vjenčanja — fotografija 2',
      'vjenčanja — fotografija 3',
    ])
  })

  it('prefers the Drive description over the fallback', async () => {
    const { sources } = await sourcesFrom({
      vjencanja: [file({ description: 'Prvi ples' })],
    })
    const manifest = buildManifest(sources, { [sources[0].id]: rendition() })
    expect(manifest.photos[0].alt).toBe('Prvi ples')
  })

  it('leaves out a photo whose renditions do not exist yet', async () => {
    const { sources } = await threeWeddings()
    const manifest = buildManifest(sources, { [sources[0].id]: rendition() })
    expect(manifest.photos).toHaveLength(1)
  })

  it('gives a page slot the most recently added image', async () => {
    const { sources } = await sourcesFrom({
      'o-meni': [
        file({ id: 'old', md5Checksum: '1', createdTime: '2026-01-01T00:00:00.000Z' }),
        file({ id: 'new', md5Checksum: '2', createdTime: '2026-06-01T00:00:00.000Z' }),
      ],
    })
    const renditions = Object.fromEntries(sources.map((s) => [s.id, rendition()]))
    const manifest = buildManifest(sources, renditions)
    const newest = sources.find((s) => s.driveId === 'new')
    expect(manifest.pages.about.id).toBe(newest.id)
  })

  it('fills the cover slot from the naslovna folder', async () => {
    const { sources } = await sourcesFrom({
      naslovna: [file({ description: 'Prvi ples' })],
    })
    const manifest = buildManifest(sources, { [sources[0].id]: rendition() })
    expect(manifest.pages.hero).toMatchObject({ alt: 'Prvi ples' })
    expect(manifest.pages.about).toBeUndefined()
  })

  it('gives a page image a slot-specific alt when Drive has no description', async () => {
    const { sources } = await sourcesFrom({
      naslovna: [file({ id: 'h', md5Checksum: '1' })],
      'o-meni': [file({ id: 'p', md5Checksum: '2' })],
    })
    const renditions = Object.fromEntries(sources.map((s) => [s.id, rendition()]))
    const manifest = buildManifest(sources, renditions)
    expect(manifest.pages.hero.alt).toBe('Fotografija Damira Sukopa')
    expect(manifest.pages.about.alt).toBe('Damir Sukop, portret')
  })

  it('keeps page images out of the gallery', async () => {
    const { sources } = await sourcesFrom({ 'o-meni': [file()] })
    const manifest = buildManifest(sources, { [sources[0].id]: rendition() })
    expect(manifest.photos).toEqual([])
  })
})

describe('fallbackAlt', () => {
  it('uses the Croatian category name', () => {
    expect(fallbackAlt('weddings', 2)).toBe('vjenčanja — fotografija 2')
    expect(fallbackAlt('products', 1)).toBe('proizvodi — fotografija 1')
  })
})

describe('rankOf', () => {
  it('reads a leading number, with or without a separator', () => {
    expect(rankOf('03 - prvi ples.jpg')).toBe(3)
    expect(rankOf('01_prstenje.png')).toBe(1)
    expect(rankOf('02.jpg')).toBe(2)
    expect(rankOf('10 prsten.jpg')).toBe(10)
  })

  it('drops the leading zeros', () => {
    expect(rankOf('005.jpg')).toBe(5)
  })

  it('leaves an unnumbered file unranked', () => {
    expect(rankOf('@capturedwell_-73.jpg')).toBeNull()
    expect(rankOf('Image 15.09.2026. at 23.21.PNG')).toBeNull()
  })

  it('does not mistake a year for a rank', () => {
    // Four digits is not a position in a gallery, and treating it as one
    // would send the photo to the front of the category.
    expect(rankOf('2026 vjencanje.jpg')).toBeNull()
  })
})

describe('rank in the manifest', () => {
  it('carries a numbered file name through', async () => {
    const { sources } = await sourcesFrom({
      vjencanja: [file({ name: '02 - prsten.jpg' })],
    })
    const manifest = buildManifest(sources, { [sources[0].id]: rendition() })
    expect(manifest.photos[0].rank).toBe(2)
  })

  it('leaves the field out entirely for an unnumbered photo', async () => {
    const { sources } = await sourcesFrom({ vjencanja: [file({ name: 'foto.jpg' })] })
    const manifest = buildManifest(sources, { [sources[0].id]: rendition() })
    expect('rank' in manifest.photos[0]).toBe(false)
  })
})

describe('sameManifest', () => {
  const build = async (name, description) => {
    const { sources } = await sourcesFrom({ vjencanja: [file({ name, description })] })
    return buildManifest(sources, { [sources[0].id]: rendition() })
  }

  it('ignores the version and the timestamp', async () => {
    const a = await build('foto.jpg', 'Ana i Marko')
    const b = { ...a, version: a.version + 9, updatedAt: '2030-01-01T00:00:00.000Z' }
    expect(sameManifest(a, b)).toBe(true)
  })

  it('notices a renamed file', async () => {
    // The case the sync used to miss: renaming changes neither the contents
    // nor the id, so nothing needs rebuilding — but the order does change.
    expect(sameManifest(await build('foto.jpg'), await build('01 - foto.jpg'))).toBe(
      false,
    )
  })

  it('notices an edited description', async () => {
    expect(
      sameManifest(await build('foto.jpg', ''), await build('foto.jpg', 'Prsten')),
    ).toBe(false)
  })

  it('treats a missing manifest as different, so the first run writes one', async () => {
    expect(sameManifest(await build('foto.jpg'), null)).toBe(false)
  })
})

describe('unreadable photos', () => {
  it('are not rebuilt on every run once recorded', async () => {
    const { sources } = await sourcesFrom({ lifestyle: [file()] })
    const state = buildState(sources, {}, { unreadable: [sources[0].id] })
    expect(planSync(sources, state).toBuild).toEqual([])
  })

  it('are tried again when the file is replaced', async () => {
    const before = await sourcesFrom({ lifestyle: [file({ md5Checksum: 'broken' })] })
    const state = buildState(before.sources, {}, { unreadable: [before.sources[0].id] })

    const after = await sourcesFrom({ lifestyle: [file({ md5Checksum: 'fixed' })] })
    expect(planSync(after.sources, state).toBuild).toHaveLength(1)
  })

  it('are forgotten once gone from Drive', async () => {
    const { sources } = await sourcesFrom({ lifestyle: [file()] })
    const state = buildState([], {}, { unreadable: [sources[0].id] })
    expect(state.unreadable).toBeUndefined()
  })
})

describe('pendingChanges', () => {
  const published = async (byFolder) => {
    const { sources } = await sourcesFrom(byFolder)
    const renditions = Object.fromEntries(sources.map((s) => [s.id, rendition()]))
    return {
      state: buildState(sources, renditions),
      manifest: buildManifest(sources, renditions),
    }
  }

  it('reports nothing when Drive matches what is published', async () => {
    const { state, manifest } = await published({ lifestyle: [file()] })
    const { sources } = await sourcesFrom({ lifestyle: [file()] })
    expect(pendingChanges(sources, state, manifest).changed).toBe(false)
  })

  it('reports a new photo', async () => {
    const { state, manifest } = await published({ lifestyle: [file()] })
    const { sources } = await sourcesFrom({
      lifestyle: [file(), file({ id: 'drive-2', md5Checksum: 'other' })],
    })
    expect(pendingChanges(sources, state, manifest).changed).toBe(true)
  })

  it('reports a deleted photo', async () => {
    const { state, manifest } = await published({ lifestyle: [file()] })
    expect(pendingChanges([], state, manifest).changed).toBe(true)
  })

  it('reports an edited description, which rebuilds no pixels', async () => {
    const { state, manifest } = await published({ lifestyle: [file()] })
    const { sources } = await sourcesFrom({
      lifestyle: [file({ description: 'Prvi ples' })],
    })
    const pending = pendingChanges(sources, state, manifest)
    expect(pending.toBuild).toEqual([])
    expect(pending.changed).toBe(true)
  })

  it('reports a rename that reorders the category', async () => {
    const { state, manifest } = await published({ lifestyle: [file()] })
    const { sources } = await sourcesFrom({ lifestyle: [file({ name: '05 - foto.jpg' })] })
    expect(pendingChanges(sources, state, manifest).changed).toBe(true)
  })

  it('reports everything on a first run', async () => {
    const { sources } = await sourcesFrom({ lifestyle: [file()] })
    expect(pendingChanges(sources, null, null).changed).toBe(true)
  })

  it('stays quiet about a photo recorded as unreadable', async () => {
    // Otherwise the cron Worker starts a workflow every five minutes to fail
    // on the same file.
    const { sources } = await sourcesFrom({ lifestyle: [file()] })
    const state = buildState(sources, {}, { unreadable: [sources[0].id] })
    const manifest = buildManifest(sources, {})
    expect(pendingChanges(sources, state, manifest).changed).toBe(false)
  })
})
