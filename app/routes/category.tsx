import { useState } from 'react'
import { Link, NavLink, data } from 'react-router'
import type { Route } from './+types/category'
import { Layout } from '~/components/Layout'
import { Photo } from '~/components/Photo'
import { JustifiedRows } from '~/components/JustifiedRows'
import { Lightbox } from '~/components/Lightbox'
import { Dot } from '~/components/Dot'
import { ArrowRight } from '~/components/icons'
import { CATEGORIES, categoryBySlug, nextCategory } from '~/lib/categories'
import { gallery } from '~/lib/gallery'
import { photosInCategory } from '~/lib/gallery-types'
import { SITE } from '~/lib/site'

export function loader({ params }: Route.LoaderArgs) {
  const category = categoryBySlug(params.slug)
  // An unknown slug is a 404, not an empty page — otherwise every typo
  // renders a valid-looking category with no photos in it.
  if (!category) throw data('Kategorija ne postoji', { status: 404 })
  return { slug: category.slug }
}

export function meta({ params }: Route.MetaArgs) {
  const category = categoryBySlug(params.slug)
  const name = category?.name ?? 'galerija'
  return [
    { title: `${name} — ${SITE.name}` },
    { name: 'description', content: `Fotografije iz kategorije ${name}.` },
  ]
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const category = categoryBySlug(loaderData.slug)!
  const photos = photosInCategory(gallery, category.id)
  const next = nextCategory(category.slug)
  const [openAt, setOpenAt] = useState<number | null>(null)

  return (
    <Layout>
      <section className="flex flex-col gap-xl px-gutter pb-xl pt-xl">
        <div className="flex items-center gap-2.5 text-label">
          <Link to="/galerija" className="text-ink-muted hover:text-ink">
            galerija
          </Link>
          <Dot size="xs" />
          <span className="text-ink-subtle">{category.name}</span>
        </div>

        <div className="flex flex-col items-start justify-between gap-lg lg:flex-row lg:items-end">
          <h1 className="m-0 text-display">{category.name}.</h1>
          <nav aria-label="Kategorije" className="flex flex-wrap gap-xs pb-2">
            {CATEGORIES.map((c) => (
              <NavLink
                key={c.id}
                to={`/galerija/${c.slug}`}
                className={({ isActive }) =>
                  `flex h-10 items-center rounded-pill px-5 text-label transition-colors duration-150 ease-out-soft ${
                    isActive
                      ? 'bg-solid text-bg'
                      : 'border border-line-strong text-ink-muted hover:border-ink hover:text-ink'
                  }`
                }
              >
                {c.name}
              </NavLink>
            ))}
          </nav>
        </div>
      </section>

      {photos.length === 0 ? (
        <p className="m-0 px-gutter py-2xl text-lead text-ink-subtle">
          U ovoj kategoriji još nema fotografija.
        </p>
      ) : (
        <JustifiedRows
          photos={photos}
          renderItem={(photo, sizes) => {
            const index = photos.indexOf(photo)
            return (
              <button
                type="button"
                onClick={() => setOpenAt(index)}
                aria-label={`Otvori fotografiju: ${photo.alt}`}
                className="group relative block w-full cursor-zoom-in"
              >
                <Photo photo={photo} sizes={sizes} />
                {/* The focus ring sits inside the photo. An outside ring on a
                    6px grid would collide with the neighbouring image. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-2 rounded-focus border-2 border-ink opacity-0 group-focus-visible:opacity-100"
                />
              </button>
            )
          }}
        />
      )}

      <section className="flex flex-col items-center gap-xl px-gutter pb-3xl pt-2xl">
        <Dot size="lg" className="bg-ink" />
        <Link
          to={`/galerija/${next.slug}`}
          className="inline-flex h-12 items-center gap-2.5 rounded-pill border border-line-strong px-md text-label text-ink transition-colors duration-150 ease-out-soft hover:border-ink"
        >
          <span>sljedeće: {next.name}</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </section>

      {openAt !== null && (
        <Lightbox
          photos={photos}
          index={openAt}
          categoryName={category.name}
          onClose={() => setOpenAt(null)}
          onIndexChange={setOpenAt}
        />
      )}
    </Layout>
  )
}
