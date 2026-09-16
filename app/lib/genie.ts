/**
 * Clip-path geometry for the Dock genie.
 *
 * The real effect is not a scale. The window is pulled through a slot: it
 * keeps its width up top, necks down to the width of its target, and the
 * sides between the two bow inward on a curve. Reproducing that with
 * `transform` alone is impossible — an affine transform cannot bend edges —
 * so the silhouette is a clip-path polygon and the transform only supplies
 * the travel.
 *
 * All values are percentages of the photo's own box, which is what
 * `clip-path` wants and what keeps this independent of pixel sizes.
 */

export type Neck = {
  /** Centre of the slot, across the photo's width. */
  cx: number
  /** The slot's own line, down the photo's height. */
  cy: number
  /** Half the slot's width. */
  half: number
}

/** Rows sampled down each side. More is smoother and costs nothing at runtime. */
const ROWS = 14

/**
 * How far from the slot, in percent of the photo's height, the sides need to
 * travel before they reach full width.
 *
 * Fixed on purpose. Measuring it against the shape's current extent instead
 * means the outermost row always lands at full width, however small the
 * shape is — so the very first frame is already a full-width sliver and the
 * bow never appears.
 */
const BOW_SPAN = 62

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const clamp = (n: number) => Math.min(100, Math.max(0, n))
/** Smoothstep: flat at both ends, so the neck meets the body without a corner. */
const smooth = (t: number) => t * t * (3 - 2 * t)

/**
 * Where the photo's two edges sit on a given row, at a given progress.
 *
 * Two widenings compose. The first is spatial: rows far from the slot are
 * already wide while rows near it are still pinched, which is the bow. The
 * second is temporal, and it interpolates each edge toward its own side of
 * the box rather than growing a half-width around the slot. That distinction
 * is load-bearing: a slot near the right edge grown symmetrically overshoots
 * on one side and never reaches the other, so the finished photo stays
 * cropped down its left third.
 */
function edgesAt(row: number, p: number, neck: Neck): [number, number] {
  const away = smooth(clamp01(Math.abs(row - neck.cy) / BOW_SPAN))
  const bowed = neck.half + (50 - neck.half) * away
  // Cubed, not squared: the neck has to outlive the travel or the transform
  // finishes the growth before the warp has been seen at all.
  const t = p * p * p
  const left = neck.cx - bowed
  const right = neck.cx + bowed
  return [clamp(left + (0 - left) * t), clamp(right + (100 - right) * t)]
}

/**
 * The silhouette at `progress`, as a `clip-path` polygon.
 *
 * At 0 the photo is a sliver at the slot; at 1 it is the full rectangle, so
 * the finished state clips nothing.
 *
 * Every progress produces the same number of points, including 1. Browsers
 * interpolate polygons point by point and fall back to a hard cut the moment
 * two keyframes disagree on the count — so a tidy four-point rectangle at the
 * end would strand the whole animation on the previous frame and snap.
 */
export function geniePolygon(progress: number, neck: Neck): string {
  const p = clamp01(progress)

  // The slot opens along the height first, then the sides unbow.
  const spread = smooth(clamp01(p * 1.15))
  const top = neck.cy - neck.cy * spread
  const bottom = neck.cy + (100 - neck.cy) * spread

  const right: string[] = []
  const left: string[] = []
  for (let i = 0; i <= ROWS; i += 1) {
    const row = top + ((bottom - top) * i) / ROWS
    const [l, r] = edgesAt(row, p, neck)
    right.push(`${r.toFixed(2)}% ${row.toFixed(2)}%`)
    left.push(`${l.toFixed(2)}% ${row.toFixed(2)}%`)
  }
  return `polygon(${[...right, ...left.reverse()].join(', ')})`
}

/** Keyframes for the Web Animations API, sampled evenly across the open. */
export function genieKeyframes(neck: Neck, steps = 22): { clipPath: string }[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({
    clipPath: geniePolygon(i / steps, neck),
  }))
}
