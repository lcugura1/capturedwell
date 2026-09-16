import { Link } from 'react-router'
import type { MetaFunction } from 'react-router'
import { Layout, StretchedHeading } from '~/components/Layout'
import { Photo } from '~/components/Photo'
import { Dot } from '~/components/Dot'
import { ArrowUpRight } from '~/components/icons'
import { CATEGORIES } from '~/lib/categories'
import { gallery } from '~/lib/gallery'
import { photosInCategory } from '~/lib/gallery-types'
import { SITE } from '~/lib/site'

export const meta: MetaFunction = () => [
  { title: `galerija — ${SITE.name}` },
  {
    name: 'description',
    content: 'Vjenčanja, lifestyle, događaji i studio — četiri kategorije radova.',
  },
]

export default function GalleryOverview() {
  return (
    <Layout>
      <section className="px-gutter py-xl">
        <StretchedHeading words={['četiri', 'priče.']} />
      </section>

      <section className="grid grid-cols-1 gap-photo-gap pb-3xl md:grid-cols-2">
        {CATEGORIES.map((category) => {
          // The cover is the first photo of the category — pinned photos
          // sort first, so Damir controls it by pinning rather than by a
          // separate "cover" field nobody would remember to set.
          const cover = photosInCategory(gallery, category.id)[0]
          return (
            <Link
              key={category.id}
              to={`/galerija/${category.slug}`}
              className="group flex flex-col text-ink"
            >
              <div className="h-[min(50vh,560px)] overflow-hidden">
                {cover ? (
                  <Photo photo={cover} sizes="(max-width: 768px) 100vw, 50vw" />
                ) : (
                  <div className="flex size-full items-center justify-center bg-surface text-label text-ink-subtle">
                    još nema fotografija
                  </div>
                )}
              </div>
              <div className="flex h-16 items-center justify-between px-sm">
                <span className="flex items-center gap-2.5 text-h3">
                  <Dot size="md" className="bg-ink" />
                  {category.name}
                </span>
                <ArrowUpRight className="size-5 text-ink-muted transition-colors duration-150 ease-out-soft group-hover:text-ink" />
              </div>
            </Link>
          )
        })}
      </section>
    </Layout>
  )
}
