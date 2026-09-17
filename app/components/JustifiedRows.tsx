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

  return (
    // Rows arrive in sequence rather than as a block.
    <div className="flex flex-col gap-photo-gap" data-reveal-stagger="0.07">
      {rows.map((row, i) => {
        const rowSum = row.reduce((total, p) => total + aspect(p), 0)
        return (
          <div key={i} className="flex flex-col gap-photo-gap sm:flex-row">
            {row.map((photo) => {
              // Share of the row this photo occupies, which is also the
              // share of the viewport it will be asked to fill.
              const share = Math.round((aspect(photo) / rowSum) * 100)
              const sizes = `(max-width: 640px) 100vw, ${share}vw`
              return (
                <div
                  key={photo.id}
                  className="min-w-0"
                  style={{ flex: `${aspect(photo)} 1 0` }}
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
