import { useCallback, useEffect, useRef, useState } from 'react'
import { SectionTitle } from '~/components/SectionTitle'
import { Photo } from '~/components/Photo'
import { Dot } from '~/components/Dot'
import { IconButton } from '~/components/Button'
import { ChevronLeft, ChevronRight } from '~/components/icons'
import { gallery } from '~/lib/gallery'
import { reviewsNewestFirst, type Review } from '~/lib/gallery-types'

const reviews = reviewsNewestFirst(gallery)

/**
 * A reviewer's link, only if it is an ordinary web address.
 *
 * The href was typed by a stranger into a form. Damir reads every review
 * before it is published, but he reads the text, not the markup of a link
 * he never sees — so a `javascript:` URL is refused here as well as where
 * the review is submitted, rather than trusted to either check alone.
 */
function safeHref(href: string): string | null {
  try {
    const url = new URL(href)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

function ReviewItem({ review }: { review: Review }) {
  const href = review.link ? safeHref(review.link.href) : null
  const paragraphs = review.text.split(/\n\s*\n/).filter(Boolean)

  return (
    <li className="w-[min(80vw,25rem)] shrink-0 snap-start">
      <figure className="m-0 flex flex-col gap-md">
        {/* 4:5, the same frame as the About portrait. Not rounded: the
            circles on Wfolio were its template, and photographs on this
            site keep their corners. */}
        {review.photo && (
          <div className="relative aspect-[4/5] bg-surface">
            <Photo
              photo={review.photo}
              kind="review"
              fill
              sizes="(min-width: 48rem) 25rem, 80vw"
            />
          </div>
        )}
        <blockquote className="m-0 flex flex-col gap-sm text-body text-ink-body">
          {/* The Croatian opening quote in the slab the section titles use.
              The one ornament in the section, and it carries meaning: what
              follows is someone else's words. Set large and given almost no
              box — the glyph sits low on its line, so at its natural height
              it would open a hole above the text it introduces. */}
          <span
            aria-hidden="true"
            className="block h-[0.55em] font-display text-h1 leading-[0.3] text-retro-mustard"
          >
            „
          </span>
          {paragraphs.map((paragraph, i) => (
            <p key={i} className="m-0 text-pretty">
              {paragraph}
            </p>
          ))}
        </blockquote>
        <figcaption className="flex flex-wrap items-center gap-x-xs gap-y-2xs">
          <span className="text-field text-ink">{review.name}</span>
          {href && review.link && (
            <>
              <Dot size="xs" />
              {/* `ugc nofollow`: the link was written by a visitor, and the
                  site should not vouch for it to search engines. */}
              <a
                href={href}
                target="_blank"
                rel="ugc nofollow noreferrer"
                className="text-label text-ink-muted transition-colors duration-150 ease-out-soft hover:text-ink"
              >
                {review.link.label}
              </a>
            </>
          )}
        </figcaption>
      </figure>
    </li>
  )
}

/**
 * What clients said, one after another along a strip.
 *
 * A strip rather than a grid because the texts run from forty characters to
 * five hundred: three columns of that is a row of ragged bottoms. Along a
 * strip each review takes the height it needs and nothing lines up against
 * it. On a phone the edge of the next one shows, which is the whole
 * affordance; on a wider screen, where a mouse has no sideways wheel, two
 * buttons step through it.
 */
export function Reviews() {
  const listRef = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const measure = useCallback(() => {
    const list = listRef.current
    if (!list) return
    // One pixel of slack: fractional scroll positions on zoomed or
    // high-density screens stop a hair short of the true end.
    setEdges({
      start: list.scrollLeft <= 1,
      end: list.scrollLeft + list.clientWidth >= list.scrollWidth - 1,
    })
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const step = (direction: 1 | -1) => {
    const list = listRef.current
    const item = list?.querySelector('li')
    if (!list || !item) return
    const gap = parseFloat(getComputedStyle(list).columnGap) || 0
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    list.scrollBy({
      left: direction * (item.getBoundingClientRect().width + gap),
      behavior: still ? 'auto' : 'smooth',
    })
  }

  return (
    <section id="recenzije" className="flex scroll-mt-header flex-col gap-xl">
      <div className="flex items-end justify-between gap-md px-gutter" data-reveal>
        <SectionTitle>rekli su</SectionTitle>
        {reviews.length > 1 && (
          <div className="hidden shrink-0 gap-xs md:flex">
            <IconButton label="Prethodna recenzija" onClick={() => step(-1)} disabled={edges.start}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <IconButton label="Sljedeća recenzija" onClick={() => step(1)} disabled={edges.end}>
              <ChevronRight className="size-5" />
            </IconButton>
          </div>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="m-0 px-gutter text-lead text-ink-subtle">Još nema recenzija.</p>
      ) : (
        // Focusable so a keyboard can scroll it with the arrow keys; the
        // label is what a screen reader announces on arrival.
        <ul
          ref={listRef}
          onScroll={measure}
          tabIndex={0}
          aria-label="Recenzije klijenata"
          className="m-0 flex list-none snap-x snap-mandatory scroll-px-gutter gap-lg overflow-x-auto px-gutter pb-2xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          data-reveal
        >
          {reviews.map((review) => (
            <ReviewItem key={review.id} review={review} />
          ))}
        </ul>
      )}
    </section>
  )
}
