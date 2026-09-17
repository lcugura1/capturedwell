import { Dot } from './Dot'

/**
 * The full stop from the logo, used as the seam between sections.
 *
 * It owns the gap on both sides, which is why the sections it separates
 * carry no padding of their own against it — a section adding its own step
 * on top put 64px above the dot and 136px below, and the divider sat
 * off-centre in its own space.
 */
export function SectionBreak() {
  return (
    <div className="flex justify-center py-xl">
      <Dot size="lg" className="bg-ink" />
    </div>
  )
}
