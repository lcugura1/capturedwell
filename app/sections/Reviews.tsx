import { useCallback, useEffect, useRef, useState } from 'react'
import { SectionTitle } from '~/components/SectionTitle'
import { Photo } from '~/components/Photo'
import { Dot } from '~/components/Dot'
import { gallery } from '~/lib/gallery'
import { reviewsNewestFirst, type Review } from '~/lib/gallery-types'
import { aspectOf } from '~/lib/images'

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
 * The lightbox's arrows, brought out of the dialog: a guillemet from the
 * slab face, mustard back and rust forward. On this site that shape and those
 * colours already mean "previous" and "next", so the strip uses them rather
 * than a second kind of arrow.
 *
 * Hidden at the end of the strip rather than dimmed, as in the lightbox —
 * but hidden with `invisible`, which keeps its space, so the other arrow does
 * not jump sideways when one goes.
 */
function GlyphButton({
  label,
  glyph,
  colour,
  onClick,
  disabled,
}: {
  label: string
  glyph: string
  colour: string
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`font-display text-h1 leading-none transition-transform duration-200 ease-out-soft hover:scale-110 active:scale-95 disabled:invisible ${colour}`}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
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
          <div className="hidden shrink-0 gap-md md:flex">
            <GlyphButton
              label="Prethodna recenzija"
              glyph="‹"
              colour="text-retro-mustard"
              onClick={() => step(-1)}
              disabled={edges.start}
            />
            <GlyphButton
              label="Sljedeća recenzija"
              glyph="›"
              colour="text-retro-rust"
              onClick={() => step(1)}
              disabled={edges.end}
            />
          </div>
        )}
      </div>

      {/* The photograph at its own proportions, never cropped. The frame
          used to be a fixed band, and cropping a picture into a shape it
          was not composed for is what made it look zoomed in: 5:2 took a
          fifth off a 2:1 photograph, 6:1 took most of it. Now the frame is
          the photograph's shape, so `fill` fills it exactly.

          Full width on a phone. Above that a fixed, modest height with the
          width following from the ratio, left-aligned under the title —
          short enough that the reviews start on the same screen.

          The ratio goes in as custom properties, one per twin, because the
          phone twin may be a different shape and a media query picks which
          applies; inline styles cannot ask one. */}
      {cover && (
        <div className="px-gutter">
          <div
            className="relative aspect-(--ratio-phone) w-full bg-surface md:aspect-(--ratio) md:h-[min(40svh,22rem)] md:w-auto md:max-w-full"
            style={
              {
                '--ratio': aspectOf(cover),
                '--ratio-phone': aspectOf(coverPhone ?? cover),
              } as React.CSSProperties
            }
          >
            <Photo
              photo={cover}
              mobile={coverPhone}
              kind="page"
              fill
              alt={cover.alt}
              sizes="(min-width: 48rem) 44rem, 100vw"
            />
          </div>
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
