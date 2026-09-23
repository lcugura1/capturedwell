import { photographs } from '~/lib/plural'

/**
 * The way out of a capped grid: opens the viewer on the last photo shown,
 * with the whole category behind it to scroll through.
 *
 * Drawn in the lightbox's own language rather than as a button. The guillemet
 * is the same Alfa Slab One glyph the lightbox uses for "next", in the same
 * retro rust — on this site that shape and that colour mean forward, and this
 * control lands you exactly where that arrow would have taken you. A pill
 * button here would have read as a different kind of thing entirely, and the
 * grid it sits under has no chrome for it to belong to.
 *
 * The label counts what is left rather than naming the action. "pogledaj sve"
 * says nothing a visitor cannot already see; "još 13 fotografija" tells them
 * whether it is worth the click.
 */
export function MorePhotos({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <div className="px-gutter pt-lg">
      <button
        type="button"
        onClick={onClick}
        // It opens a dialog, and the glyph alone does not say so.
        aria-haspopup="dialog"
        className="group inline-flex items-center gap-sm text-label text-ink-muted transition-colors duration-150 ease-out-soft hover:text-ink"
      >
        još {count} {photographs(count)}
        {/* Slides rather than scales on hover: the lightbox arrows scale
            because they sit over a photograph with nowhere to go, and this
            one is in the flow of the page, pointing at what comes next. */}
        <span
          aria-hidden="true"
          className="font-display text-h2 leading-none text-retro-rust transition-transform duration-200 ease-out-soft group-hover:translate-x-1"
        >
          ›
        </span>
      </button>
    </div>
  )
}
