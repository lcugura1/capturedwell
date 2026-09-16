/**
 * The four glyphs the design uses. Hand-written rather than pulled from an
 * icon package: four paths do not justify a dependency, and these inherit
 * stroke width and colour from the design rather than from someone else's
 * grid.
 */
type Props = { className?: string }

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export function ArrowUpRight({ className }: Props) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M5 11L11 5M6 5h5v5" />
    </svg>
  )
}

export function ChevronLeft({ className }: Props) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M10 3L5 8l5 5" />
    </svg>
  )
}

export function ChevronRight({ className }: Props) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M6 3l5 5-5 5" />
    </svg>
  )
}

export function ArrowRight({ className }: Props) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

export function Close({ className }: Props) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  )
}

export function Mail({ className }: Props) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden="true" {...STROKE}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.5 4.5L8 8.5l5.5-4" />
    </svg>
  )
}
