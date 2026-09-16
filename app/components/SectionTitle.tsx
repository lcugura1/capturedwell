/**
 * The vintage section title: a heavy slab, one colour per letter.
 *
 * Accessibility matters more than usual here. Splitting a word into one
 * <span> per character makes some screen readers announce it letter by
 * letter — "o, space, m, e, n, i" instead of "o meni". So the real text
 * goes on the heading as `aria-label` and every fragment is hidden from
 * the accessibility tree. Selecting and copying still yields the word,
 * because the characters are all still there in order.
 *
 * Colours cycle through the retro palette and skip spaces, so the rhythm
 * carries across a two-word title instead of restarting.
 */
const PALETTE = [
  'text-retro-cream',
  'text-retro-mustard',
  'text-retro-rust',
  'text-retro-teal',
] as const

export function SectionTitle({
  children,
  as: Tag = 'h2',
  className = '',
}: {
  children: string
  as?: 'h1' | 'h2'
  className?: string
}) {
  let colourIndex = 0

  return (
    <Tag
      aria-label={children}
      className={`m-0 font-display text-section text-balance ${className}`}
    >
      {Array.from(children).map((char, i) => {
        if (char === ' ') {
          return (
            <span key={i} aria-hidden="true">
              {' '}
            </span>
          )
        }
        const colour = PALETTE[colourIndex % PALETTE.length]
        colourIndex += 1
        return (
          <span key={i} aria-hidden="true" className={colour}>
            {char}
          </span>
        )
      })}
    </Tag>
  )
}
