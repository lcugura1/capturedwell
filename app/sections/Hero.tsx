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
      <section id="vrh" className="relative h-[min(86vh,860px)] overflow-hidden">
        {hero && <Photo photo={hero} sizes="100vw" priority />}
        {/* Scrim under the header only: the nav has to stay legible over a
            bright photo without dimming the photograph as a whole. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[180px] bg-gradient-to-b from-bg/55 to-transparent"
        />
      </section>

      <section className="px-gutter pt-xl">
        <StretchedHeading words={['capturedwell_']} />
      </section>

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
