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
 * The one photograph above the reviews, from the `recenzije` folder on Drive,
 * with `recenzije-mobitel` standing in on phones when it has something.
 *
 * One image for the section rather than one per review: Damir decided the
 * reviews should be words only. Absent until the folder is filled, and then
 * the section is simply title and text — no placeholder box on a live page.
 */
const cover = gallery.pages.reviews
const coverPhone = cover ? gallery.pages.reviewsMobile : undefined

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

/**
 * How many lines a review shows before it folds.
 *
 * The strip is as tall as its longest review, and the section has to fit one
 * screen — title, photograph and words together. Most reviews are two or
 * three lines and never fold; the few that run to a dozen would otherwise
 * set the height of the whole section.
 */
const FOLD_LINES = 'line-clamp-4'
/** Three on a short screen — a 720px laptop has no room for a fourth. */
const FOLD = `${FOLD_LINES} [@media(max-height:50rem)]:line-clamp-3`

function ReviewItem({ review }: { review: Review }) {
  const href = review.link ? safeHref(review.link.href) : null
  const textRef = useRef<HTMLParagraphElement>(null)
  const [open, setOpen] = useState(false)
  // Whether the text is actually cut off — only the browser knows, once the
  // column width and the font are real. Until then no button: a review that
  // fits is not given a control that does nothing.
  const [folds, setFolds] = useState(false)

  useEffect(() => {
    const text = textRef.current
    if (!text) return
    const check = () => {
      if (!text.classList.contains(FOLD_LINES)) return
      setFolds(text.scrollHeight > text.clientHeight + 1)
    }
    check()
    const observer = new ResizeObserver(check)
    observer.observe(text)
    return () => observer.disconnect()
  }, [])

  return (
    <li className="w-[min(80vw,25rem)] shrink-0 snap-start lg:w-[32rem]">
      <figure className="m-0 flex flex-col gap-md">
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
          {/* One element with its line breaks kept, rather than a <p> per
              paragraph: line clamping counts lines within one box, and
              across several it cuts in unpredictable places. */}
          <p
            ref={textRef}
            className={`m-0 whitespace-pre-line text-pretty ${open ? '' : FOLD}`}
          >
            {review.text}
          </p>
          {folds && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="self-start text-label text-ink-muted transition-colors duration-150 ease-out-soft hover:text-ink"
            >
              {open ? 'skrati' : 'pročitaj cijelu'}
            </button>
          )}
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
 * What clients said: one photograph, then their words along a strip.
 *
 * A strip rather than a grid because the texts run from forty characters to
 * five hundred: three columns of that is a row of ragged bottoms. Along a
 * strip each review takes the height it needs and nothing lines up against
 * it. On a phone the edge of the next one shows, which is the whole
 * affordance; on a wider screen, where a mouse has no sideways wheel, two
 * buttons beside the title step through it. Not below the strip: it is as
 * tall as its longest review, so down there they hung under a gap as tall as
 * whatever review happened to be off screen, and had to be scrolled to.
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
    <section id="recenzije" className="flex scroll-mt-header flex-col gap-lg">
      <div className="flex items-end justify-between gap-md px-gutter" data-reveal>
        <SectionTitle>rekli su</SectionTitle>
        {reviews.length > 1 && (
          <div className="hidden shrink-0 gap-xs md:flex">
            <IconButton
              label="Prethodna recenzija"
              onClick={() => step(-1)}
              disabled={edges.start}
            >
              <ChevronLeft className="size-5" />
            </IconButton>
            <IconButton
              label="Sljedeća recenzija"
              onClick={() => step(1)}
              disabled={edges.end}
            >
              <ChevronRight className="size-5" />
            </IconButton>
          </div>
        )}
      </div>

      {/* Edge to edge, like the About portrait. 4:3 on a phone, where a
          wide band would be a sliver; 5:2 above that. It was once as short
          as the screen allowed, to fit the whole section in one view, and
          at 6:1 it showed a slice across the middle of whatever was in it —
          the photograph Damir chose for it lost both a head and half the
          lettering on a shirt. 5:2 keeps a subject whole; the cap keeps it
          from taking over a short screen. The buttons sit beside the title,
          so a taller band never pushes them out of reach. The breakpoint is
          where `Photo` swaps to the phone twin. */}
      {cover && (
        <div className="relative aspect-[4/3] bg-surface md:aspect-[5/2] md:max-h-[65svh]">
          <Photo
            photo={cover}
            mobile={coverPhone}
            kind="page"
            fill
            alt={cover.alt}
            sizes="100vw"
            // A band crops top and bottom. People are framed with their heads
            // in the upper part of a picture, so the crop leans that way.
            objectPosition="50% 25%"
          />
        </div>
      )}

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
