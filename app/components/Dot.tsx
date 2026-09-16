/**
 * The full stop from the logo, reused as the one ornament on the site.
 *
 * Four sizes, each with a fixed job, so the motif stays a signature rather
 * than turning into decoration:
 *   xs (4px)  separator between meta values
 *   sm (5px)  active nav item, caption prefix, the admin dot
 *   md (6px)  section label prefix, category card title
 *   lg (8px)  end of a section
 */
const SIZES = {
  xs: 'size-[4px]',
  sm: 'size-[5px]',
  md: 'size-[6px]',
  lg: 'size-[8px]',
} as const

export function Dot({
  size = 'md',
  className = 'bg-ink-subtle',
}: {
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-pill ${SIZES[size]} ${className}`}
    />
  )
}
