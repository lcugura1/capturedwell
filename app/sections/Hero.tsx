import { Photo } from '~/components/Photo'
import { SectionLabel, StretchedHeading } from '~/components/Layout'
import { MailLink } from '~/components/MailLink'
import { Mail } from '~/components/icons'
import { gallery } from '~/lib/gallery'
import { aspect } from '~/lib/gallery-types'
import { SITE } from '~/lib/site'

/**
 * The hero photograph is the widest one in the gallery: a portrait crammed
 * into a full-bleed band gets cropped to almost nothing.
 */
const hero = [...gallery.photos].sort((a, b) => aspect(b) - aspect(a))[0]

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
          {hero && <Photo photo={hero} sizes="100vw" fill priority />}
          {/* Scrim under the header only: the nav has to stay legible over a
              bright photo without dimming the photograph as a whole. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[180px] bg-gradient-to-b from-bg/55 to-transparent"
          />
        </section>

        {/* More room below than above: `line-height: 0.9` makes the line box
            shorter than the glyphs, so the underscore of `capturedwell_`
            hangs past it. With the hero on `flex-1`, the extra clearance
            costs the photograph a few pixels and nothing else. */}
        <section className="shrink-0 px-gutter pb-xl pt-lg">
          <StretchedHeading words={['capturedwell_']} />
        </section>
      </div>

      <section className="grid grid-cols-1 gap-md px-gutter pb-2xl pt-xl lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionLabel>
            {SITE.owner.toLowerCase()}, {SITE.role}
          </SectionLabel>
        </div>
        <div className="flex flex-col gap-lg lg:col-span-7 lg:col-start-6">
          <p className="m-0 text-lead text-pretty">
            Vjenčanja, lifestyle, događaji i studio. Fotografiram ljude onakve kakvi
            jesu kad zaborave na objektiv.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="#galerija"
              className="inline-flex h-12 items-center gap-xs rounded-pill bg-solid px-md text-label text-bg transition-colors duration-150 ease-out-soft hover:bg-solid-hover"
            >
              pogledaj galeriju
            </a>
            <MailLink
              subject="Upit preko capturedwell.hr"
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
