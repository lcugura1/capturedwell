import type { Photo as PhotoType } from '~/lib/gallery-types'
import { aspect } from '~/lib/gallery-types'

/**
 * Packs photos into rows that each fill the full width at a single height.
 *
 * Within a row every item gets `flex-grow` equal to its aspect ratio, which
 * makes the widths land in proportion — so a row of a wide and a tall photo
 * ends up the same height with neither of them cropped. This is the same
 * trick the design uses; it is expressed here in one place instead of being
 * hand-tuned per row.
 *
 * Rows are closed once their combined aspect ratio passes `targetAspect`
 * (roughly: how wide the row wants to be relative to its height). A larger
 * value means more photos per row and shorter rows.
 */
export function rowsOf(photos: PhotoType[], targetAspect = 2.6): PhotoType[][] {
  const rows: PhotoType[][] = []
  let row: PhotoType[] = []
  let sum = 0

  for (const photo of photos) {
    row.push(photo)
    sum += aspect(photo)
    if (sum >= targetAspect) {
      rows.push(row)
      row = []
      sum = 0
    }
  }
  // The tail row is deliberately left short rather than stretched: blowing
  // up one leftover photo to full width makes it look like the feature of
  // the page when it is just the last one in the list.
  if (row.length > 0) rows.push(row)
  return rows
}

/**
 * The phone layout's grid, in units of `--masonry-unit` (theme.css): a
 * column is this many units wide, and the gap between tiles this many.
 */
const MASONRY_COLUMN_UNITS = 200
const MASONRY_GAP_UNITS = 9

export type MasonrySlot = { column: 1 | 2; row: string }

/**
 * Where each photo goes on a phone: always into the shorter column.
 *
 * Done here rather than left to CSS columns, which balance differently in
 * every engine — Safari left the right column a screen short of the left.
 * Every length on the grid is a fraction of the viewport, so a photo's
 * height in units depends only on its own ratio, and the placement
 * computed at build time is exact at any phone width.
 */
export function masonryOf(photos: PhotoType[]): Map<string, MasonrySlot> {
  const slots = new Map<string, MasonrySlot>()
  // Next free grid line in each column. Lines are 1-based.
  const next = [1, 1]
  for (const photo of photos) {
    const span =
      Math.max(1, Math.round(MASONRY_COLUMN_UNITS / aspect(photo))) + MASONRY_GAP_UNITS
    const i = next[1]! < next[0]! ? 1 : 0
    slots.set(photo.id, { column: i === 0 ? 1 : 2, row: `${next[i]} / span ${span}` })
    next[i]! += span
  }
  return slots
}

/**
 * On a phone the same markup becomes two masonry columns instead.
 *
 * One row of full-width photos after another made ten photographs ten
 * screens of scrolling. Two columns of rounded tiles show the set at a
 * glance. The rows dissolve (`display: contents`) and every photo is
 * placed on the grid by `masonryOf`, so there is one tree for both
 * layouts: no second copy of the grid in the HTML, and no JavaScript
 * moving tiles after a prerendered page has already painted them.
 */
export function JustifiedRows({
  photos,
  targetAspect,
  renderItem,
}: {
  photos: PhotoType[]
  targetAspect?: number
  renderItem: (photo: PhotoType, sizes: string) => React.ReactNode
}) {
  const rows = rowsOf(photos, targetAspect)
  const slots = masonryOf(photos)

  return (
    // Rows arrive in sequence rather than as a block.
    <div
      className="max-sm:grid max-sm:auto-rows-[var(--masonry-unit)] max-sm:grid-cols-2 max-sm:gap-x-masonry-gap max-sm:px-masonry-gap sm:flex sm:flex-col sm:gap-photo-gap"
      data-reveal-stagger="0.07"
    >
      {rows.map((row, i) => {
        const rowSum = row.reduce((total, p) => total + aspect(p), 0)
        return (
          <div key={i} className="max-sm:contents sm:flex sm:flex-row sm:gap-photo-gap">
            {row.map((photo) => {
              // Share of the row this photo occupies, which is also the
              // share of the viewport it will be asked to fill.
              const share = Math.round((aspect(photo) / rowSum) * 100)
              const sizes = `(max-width: 640px) 50vw, ${share}vw`
              const slot = slots.get(photo.id)!
              return (
                <div
                  key={photo.id}
                  // The slot rides in custom properties so it only takes
                  // effect under the phone breakpoint; the desktop rows are
                  // flexbox and must not see a grid placement.
                  className="min-w-0 max-sm:self-start max-sm:overflow-hidden max-sm:rounded-tile max-sm:[grid-column:var(--slot-column)] max-sm:[grid-row:var(--slot-row)]"
                  style={
                    {
                      flex: `${aspect(photo)} 1 0`,
                      '--slot-column': slot.column,
                      '--slot-row': slot.row,
                    } as React.CSSProperties
                  }
                >
                  {renderItem(photo, sizes)}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
