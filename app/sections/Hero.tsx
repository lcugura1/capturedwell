import { Photo } from '~/components/Photo'
import { StretchedHeading } from '~/components/Layout'
import { Dot } from '~/components/Dot'
import { MailLink } from '~/components/MailLink'
import { scrollToSection } from '~/lib/scroll-to-section'
import { Mail } from '~/components/icons'
import { gallery } from '~/lib/gallery'
import { aspect } from '~/lib/gallery-types'
import { ENQUIRY_SUBJECT, SITE, WORDMARK } from '~/lib/site'

/** One retro tone per line, cycled. */
const SHOOT_COLOURS = [
  'text-retro-cream',
  'text-retro-mustard',
  'text-retro-rust',
  'text-retro-teal',
] as const

/**
 * The cover photograph: whatever is newest in the `naslovna` folder on Drive.
 *
 * Falls back to the widest photo in the gallery while that folder is empty —
 * a portrait crammed into a full-bleed band gets cropped to almost nothing,
 * so width is the least bad guess. It is only a guess, though, which is why
 * the folder exists: the first image on the page is an editorial decision,
 * and an aspect ratio is not one.
 */
const chosen = gallery.pages.hero
const widest = [...gallery.photos].sort((a, b) => aspect(b) - aspect(a))[0]
const hero = chosen ?? widest

/**
 * An optional second cover, for phones.
 *
 * Only used alongside a chosen one: pairing it with the widest-photo
 * fallback would mean a phone showing one photograph and a laptop a
 * different one, neither of them picked by anybody.
 */
const heroPhone = chosen ? gallery.pages.heroMobile : undefined

/**
 * Where the subject sits across the current cover, so a phone crops around
 * them rather than around the middle of the frame.
 *
 * The couple sit right of centre in the photograph and a phone sees under a
 * third of its width — less than the pair spans, so something is always cut.
 * At `center` that was the groom, against a column of hedge on the other
 * side; past 60% it becomes the bride. This is the point where they fill the
 * frame edge to edge and neither loses an arm.
 *
 * Tied to this photograph, and the honest weakness of it: change the cover
 * and this number is a guess again. A folder cannot express a focal point,
 * so the alternative is Damir cropping the file before he uploads it. Worth
 * revisiting if covers start changing often.
 */
const HERO_FOCUS = '55% 50%'

export function Hero() {
  return (
    <>
      {/* The photograph and the wordmark below it share exactly one screen.
          The column is one viewport tall and the photo takes whatever the
          heading does not, so `capturedwell_` is always fully visible
          without scrolling — at any window size, and whatever the fluid
          type scale resolves the heading to. No magic number to re-tune
          when a size changes.

          `svh` rather than `vh`: on mobile Safari `vh` counts the area
          behind the URL bar, so the heading would sit under it until the
          user scrolled — which is the thing we are fixing. */}
      <div id="vrh" className="flex min-h-svh flex-col">
        <section className="relative min-h-[50svh] flex-1 overflow-hidden">
          {hero && (
            // A chosen cover lives under `page/` in R2; a fallen-back one is
            // an ordinary gallery photo under `img/`.
            <Photo
              photo={hero}
              mobile={heroPhone}
              objectPosition={HERO_FOCUS}
              kind={chosen ? 'page' : 'img'}
              sizes="100vw"
              fill
              priority
            />
          )}
          {/* Scrim under the header only: the nav has to stay legible over a
              bright photo without dimming the photograph as a whole. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[11.25rem] bg-gradient-to-b from-bg/55 to-transparent"
          />
        </section>

        {/* More room below than above: `line-height: 0.9` makes the line box
            shorter than the glyphs, so the underscore of `capturedwell_`
            hangs past it. With the hero on `flex-1`, the extra clearance
            costs the photograph a few pixels and nothing else. */}
        <section className="shrink-0 px-gutter pb-xl pt-lg">
          <StretchedHeading words={[WORDMARK]} />
        </section>
      </div>

      {/* No bottom padding: the section break below owns that gap. See
          components/SectionBreak.tsx. */}
      <section
        className="grid grid-cols-1 gap-md px-gutter pt-xl lg:grid-cols-12"
        data-reveal
      >
        {/* What Damir shoots, stacked, in the display face.
            The first thing a visitor needs is whether this photographer is
            for them, and the fastest answer is the list of occasions. It
            reads as a list rather than a sentence, and holds its side of
            the grid instead of leaving it blank. Deliberately a step below
            the section titles: same voice, no competition. */}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:col-span-4">
          {SITE.shoots.map((what, i) => (
            <li key={what} className="flex items-center gap-2.5">
              <Dot size="sm" className={SHOOT_COLOURS[i % SHOOT_COLOURS.length]} />
              <span
                className={`font-display text-h2 leading-none ${SHOOT_COLOURS[i % SHOOT_COLOURS.length]}`}
              >
                {what}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-lg lg:col-span-7 lg:col-start-6">
          <p className="m-0 text-lead text-pretty">
            Fotografiram ljude onakve kakvi jesu kad zaborave na objektiv.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#galerija"
              onClick={(event) => {
                event.preventDefault()
                scrollToSection('galerija')
              }}
              className="inline-flex h-12 items-center gap-xs rounded-pill bg-solid px-md text-label text-bg transition-colors duration-150 ease-out-soft hover:bg-solid-hover"
            >
              pogledaj galeriju
            </a>
            <MailLink
              subject={ENQUIRY_SUBJECT}
              className="inline-flex h-12 items-center gap-xs rounded-pill border border-line-strong px-md text-label text-ink transition-colors duration-150 ease-out-soft hover:border-ink"
            >
              <Mail className="size-4" />
              <span>javi se</span>
            </MailLink>
          </div>
        </div>
      </section>
    </>
  )
}
