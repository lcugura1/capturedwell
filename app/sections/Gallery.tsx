import { useState } from 'react'
import { Photo } from '~/components/Photo'
import { JustifiedRows } from '~/components/JustifiedRows'
import { Lightbox } from '~/components/Lightbox'
import { SectionTitle } from '~/components/SectionTitle'
import { CATEGORIES, type CategoryId } from '~/lib/categories'
import { gallery } from '~/lib/gallery'
import { photosInCategory } from '~/lib/gallery-types'

/**
 * The whole gallery, on the page.
 *
 * The four categories are a filter over one grid rather than four
 * destinations: on a single-page site a category link that navigated away
 * would be exactly the thing we removed. Switching is state, not routing,
 * so it is instant and the visitor keeps their place on the page.
 *
 * All four grids are rendered and the inactive ones are `hidden`, rather
 * than only mounting the active one. Two reasons, both load-bearing:
 * there is one page and one document now, so if a category is not in the
 * HTML then its photographs and their alt text are invisible to search —
 * and `hidden` means `display: none`, which keeps lazy images from being
 * fetched, so the extra markup costs bytes of HTML and no downloads.
 */
export function Gallery() {
  const [category, setCategory] = useState<CategoryId>(CATEGORIES[0].id)
  const [openAt, setOpenAt] = useState<number | null>(null)
  const active = CATEGORIES.find((c) => c.id === category)!
  const photos = photosInCategory(gallery, category)

  return (
    <section id="galerija" className="scroll-mt-header pt-3xl">
      <div className="flex flex-col items-start justify-between gap-lg px-gutter pb-xl lg:flex-row lg:items-end">
        <SectionTitle>{`${active.name}.`}</SectionTitle>
        <nav aria-label="Kategorije" className="flex flex-wrap gap-xs pb-2">
          {CATEGORIES.map((c) => {
            const isActive = c.id === category
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCategory(c.id)
                  // Leaving the lightbox index pointing into the old, shorter
                  // list would open an unrelated photo, or none at all.
                  setOpenAt(null)
                }}
                aria-pressed={isActive}
                className={`flex h-10 items-center rounded-pill px-5 text-label transition-colors duration-150 ease-out-soft ${
                  isActive
                    ? 'bg-solid text-bg'
                    : 'border border-line-strong text-ink-muted hover:border-ink hover:text-ink'
                }`}
              >
                {c.name}
              </button>
            )
          })}
        </nav>
      </div>

      {CATEGORIES.map((c) => {
        const inCategory = photosInCategory(gallery, c.id)
        return (
          <div key={c.id} hidden={c.id !== category}>
            {inCategory.length === 0 ? (
              <p className="m-0 px-gutter py-2xl text-lead text-ink-subtle">
                U ovoj kategoriji još nema fotografija.
              </p>
            ) : (
              <JustifiedRows
                photos={inCategory}
                renderItem={(photo, sizes) => {
                  const index = inCategory.indexOf(photo)
                  return (
                    <button
                      type="button"
                      onClick={() => setOpenAt(index)}
                      aria-label={`Otvori fotografiju: ${photo.alt}`}
                      className="group relative block w-full cursor-zoom-in"
                    >
                      <Photo photo={photo} sizes={sizes} />
                      {/* The focus ring sits inside the photo. An outside ring
                          on a 6px grid would collide with the neighbour. */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-2 rounded-focus border-2 border-ink opacity-0 group-focus-visible:opacity-100"
                      />
                    </button>
                  )
                }}
              />
            )}
          </div>
        )
      })}

      {openAt !== null && (
        <Lightbox
          photos={photos}
          index={openAt}
          categoryName={active.name}
          onClose={() => setOpenAt(null)}
          onIndexChange={setOpenAt}
        />
      )}
    </section>
  )
}
