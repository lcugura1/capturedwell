import { Link } from 'react-router'
import type { MetaFunction } from 'react-router'
import { SectionLabel, StretchedHeading } from '~/components/Layout'
import { Header } from '~/components/Header'
import { Footer } from '~/components/Footer'
import { ButtonLink } from '~/components/Button'
import { Photo } from '~/components/Photo'
import { JustifiedRows } from '~/components/JustifiedRows'
import { Dot } from '~/components/Dot'
import { ArrowUpRight, Mail } from '~/components/icons'
import { MailLink } from '~/components/MailLink'
import { gallery } from '~/lib/gallery'
import { categoryById } from '~/lib/categories'
import { SITE } from '~/lib/site'
import { aspect } from '~/lib/gallery-types'

export const meta: MetaFunction = () => [
  { title: `${SITE.name} — ${SITE.owner}, ${SITE.role}` },
  {
    name: 'description',
    content:
      'Vjenčanja, lifestyle, događaji i studio. Fotografiram ljude onakve kakvi jesu kad zaborave na objektiv.',
  },
]

export default function Home() {
  // The hero is the widest photo available: a portrait crammed into a
  // full-bleed band gets cropped to almost nothing.
  const hero = [...gallery.photos].sort((a, b) => aspect(b) - aspect(a))[0]
  // A spread across categories rather than the first six of one, so the
  // homepage shows the range of the work.
  const selected = gallery.photos.filter((p) => p.id !== hero?.id).slice(0, 6)

  return (
    <div className="flex min-h-screen flex-col">
      <section className="relative h-[min(86vh,860px)] overflow-hidden">
        {hero && (
          <Photo photo={hero} sizes="100vw" priority className="size-full object-cover" />
        )}
        {/* Scrim under the header only: the nav has to stay legible over a
            bright photo without dimming the photograph as a whole. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-[180px] bg-gradient-to-b from-bg/55 to-transparent"
        />
        {/* Laid over the hero rather than given its own band, so the
            photograph starts at the very top of the viewport. */}
        <Header overlay />
      </section>

      <main className="flex-1">
        <section className="px-gutter pt-xl">
          <StretchedHeading words={['dobro', 'uhvaćeno.']} />
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
              <ButtonLink to="/galerija">pogledaj galeriju</ButtonLink>
              <ButtonLink to="/kontakt" variant="outline">
                javi se
              </ButtonLink>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-lg">
          <div className="flex items-center justify-between px-gutter">
            <SectionLabel>odabrano</SectionLabel>
            <Link
              to="/galerija"
              className="flex items-center gap-1.5 text-label text-ink transition-colors duration-150 ease-out-soft hover:text-ink-muted"
            >
              cijela galerija
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <JustifiedRows
            photos={selected}
            renderItem={(photo, sizes) => (
              <figure className="m-0 flex flex-col gap-3">
                <Link to={`/galerija/${categoryById(photo.category).slug}`}>
                  <Photo photo={photo} sizes={sizes} />
                </Link>
                <figcaption className="flex items-center gap-xs pl-sm text-caption text-ink-subtle">
                  <Dot size="sm" />
                  <span>{categoryById(photo.category).name}</span>
                </figcaption>
              </figure>
            )}
          />
        </section>

        <section className="flex flex-col items-center gap-xl px-gutter py-3xl">
          <Dot size="lg" className="bg-ink" />
          <p className="m-0 text-center text-h2">imaš datum? javi se.</p>
          <MailLink
            subject="Upit preko capturedwell.hr"
            className="inline-flex h-12 items-center gap-xs rounded-pill bg-solid px-md text-label text-bg transition-colors duration-150 ease-out-soft hover:bg-solid-hover"
          >
            <Mail className="size-4" />
            <span>pošalji e-mail</span>
          </MailLink>
        </section>
      </main>

      <Footer />
    </div>
  )
}
