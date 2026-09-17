import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Photo as PhotoType } from '~/lib/gallery-types'
import { aspectOf, fallbackSrc, srcSet } from '~/lib/images'
import { genieKeyframes, type Neck } from '~/lib/genie'
import { useScrollLock } from '~/hooks/useScrollLock'

/** Matches the retro palette used by section titles. */
const CONTROLS = {
  close: 'text-retro-teal',
  prev: 'text-retro-mustard',
  next: 'text-retro-rust',
} as const

// Less front-loaded than a plain ease-out: at 8% of the way through, an
// easeOutQuint is already a third of the distance and the warp never gets
// seen. This holds the shape long enough to read as one.
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
/** The Dock's own genie runs about this long; anything faster reads as a pop. */
const OPEN_MS = 620
const CLOSE_MS = 420

function prefersReducedMotion() {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Full-screen photo view that grows out of the thumbnail it was opened from.
 *
 * Photos live on a horizontal scroll-snap track, so moving between them is
 * the platform's own scrolling: real momentum, a photo that follows the
 * finger rather than waiting for the gesture to finish, and rubber-band at
 * both ends. Everything — the arrows, the keyboard — drives that same
 * scroller, so there is one notion of where you are rather than two that
 * can disagree.
 *
 * The genie is two animations on the same element. The transform carries the
 * travel, with horizontal distance closing faster than vertical so the photo
 * stretches rather than scaling uniformly. The clip-path carries the shape:
 * a polygon that necks down to the width of the thumbnail and bows inward
 * between the two, which is the part a transform physically cannot do — an
 * affine transform cannot bend an edge. See lib/genie.ts.
 *
 * Closing replays both in reverse and unmounts on finish, which is why
 * `closing` exists rather than the parent dropping the component
 * immediately.
 *
 * Keyboard is a first-class path, not an afterthought — a gallery you cannot
 * arrow through is broken for anyone not using a mouse:
 *   ← →   previous / next, wrapping at both ends
 *   Esc   close
 *   Tab   cycles inside the dialog only
 */
export function Lightbox({
  photos,
  index,
  categoryName,
  onClose,
  onIndexChange,
}: {
  photos: PhotoType[]
  index: number
  categoryName: string
  onClose: () => void
  onIndexChange: (index: number) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const figureRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<Element | null>(null)
  const [closing, setClosing] = useState(false)
  const photo = photos[index]

  // The index the scroller itself last reported. Without it, reacting to
  // `index` would scroll the track back under the finger that just moved it:
  // scroll → index changes → effect scrolls → fights the gesture.
  const settledRef = useRef(index)
  // The index the photo opened at, so the genie animates the right slide and
  // swiping away afterwards does not replay it. State rather than a ref
  // because the render reads it, and a ref read during render is exactly
  // the thing that goes stale without telling you. The initialiser runs
  // once, so it stays put while `index` moves.
  const [openedAt] = useState(index)

  const scrollTo = useCallback((next: number, behavior: ScrollBehavior) => {
    const track = trackRef.current
    if (!track) return
    settledRef.current = next
    track.scrollTo({ left: next * track.clientWidth, behavior })
  }, [])

  /**
   * Transform that puts the full-size figure back onto its thumbnail.
   *
   * The thumbnail is found in the grid by id rather than handed in as a
   * rect. Two reasons: a rect captured at click time is stale the moment
   * the page scrolls, and looking it up now means closing shrinks back
   * into the photo currently on screen after arrowing, not the one that
   * happened to be clicked first.
   */
  const collapsed = useCallback(() => {
    const figure = figureRef.current
    const current = photos[index]
    if (!figure || !current) return null
    const thumb = document.querySelector(`[data-photo-id="${CSS.escape(current.id)}"]`)
    if (!thumb) return null
    const from = thumb.getBoundingClientRect()
    const to = figure.getBoundingClientRect()
    if (to.width === 0 || to.height === 0 || from.width === 0) return null
    const pct = (n: number) => Math.min(100, Math.max(0, n * 100))
    const neck: Neck = {
      cx: pct((from.left + from.width / 2 - to.left) / to.width),
      cy: pct((from.top + from.height / 2 - to.top) / to.height),
      // Never let the slot close completely: a zero-width neck renders as
      // nothing at all for the first frames instead of a sliver.
      half: Math.max(3, Math.min(50, (from.width / to.width) * 50)),
    }
    return {
      dx: from.left - to.left,
      dy: from.top - to.top,
      sx: from.width / to.width,
      sy: from.height / to.height,
      neck,
    }
  }, [photos, index])

  useLayoutEffect(() => {
    // Land on the photo that was clicked before anything paints. Instant,
    // not smooth: a visible scroll here would race the genie.
    const track = trackRef.current
    if (track) track.scrollLeft = openedAt * track.clientWidth

    const figure = figureRef.current
    const backdrop = backdropRef.current
    const from = collapsed()
    if (!figure || !backdrop || !from || prefersReducedMotion()) return

    const { dx, dy, sx, sy, neck } = from
    figure.animate(genieKeyframes(neck), {
      duration: OPEN_MS,
      easing: EASE,
      fill: 'both',
    })
    figure.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.7 },
        {
          // Width and horizontal travel are most of the way home while the
          // height still has ground to cover: that lag is the genie.
          transform: `translate(${dx * 0.2}px, ${dy * 0.45}px) scale(${sx + (1 - sx) * 0.82}, ${sy + (1 - sy) * 0.45})`,
          opacity: 1,
          offset: 0.5,
        },
        { transform: 'none', opacity: 1 },
      ],
      { duration: OPEN_MS, easing: EASE, fill: 'both' },
    )
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: OPEN_MS * 0.6,
      easing: 'linear',
      fill: 'both',
    })
    // Only on mount: re-running this on every swipe would replay the whole
    // open animation instead of just moving to the next photograph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dismiss = useCallback(() => {
    const figure = figureRef.current
    const backdrop = backdropRef.current
    const to = collapsed()
    if (!figure || !backdrop || !to || prefersReducedMotion()) {
      onClose()
      return
    }
    setClosing(true)
    const { dx, dy, sx, sy, neck } = to
    figure.animate([...genieKeyframes(neck)].reverse(), {
      duration: CLOSE_MS,
      easing: EASE,
      fill: 'both',
    })
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: CLOSE_MS,
      easing: 'linear',
      fill: 'both',
    })
    const shrink = figure.animate(
      [
        { transform: 'none', opacity: 1 },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          opacity: 0.7,
        },
      ],
      { duration: CLOSE_MS, easing: EASE, fill: 'both' },
    )
    shrink.onfinish = onClose
    // If the browser drops the animation (a background tab, mostly), the
    // dialog would stay up forever waiting for a finish that never comes.
    shrink.oncancel = onClose
  }, [collapsed, onClose])

  const go = useCallback(
    (delta: number) => {
      if (photos.length === 0) return
      scrollTo((index + delta + photos.length) % photos.length, 'smooth')
    },
    [index, photos.length, scrollTo],
  )

  // Follow the scroller. `scrollend` fires once the gesture and its momentum
  // have finished, which is exactly when the index should change; where it
  // is missing, a short idle timer says the same thing a little later.
  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const settle = () => {
      const width = track.clientWidth
      if (width === 0) return
      const landed = Math.max(0, Math.min(photos.length - 1, Math.round(track.scrollLeft / width)))
      if (landed === settledRef.current) return
      settledRef.current = landed
      onIndexChange(landed)
    }

    // Feature-detect on window, not on the element: `'onscrollend' in track`
    // narrows the element to `never` in the negative branch.
    if (typeof window !== 'undefined' && 'onscrollend' in window) {
      track.addEventListener('scrollend', settle)
      return () => track.removeEventListener('scrollend', settle)
    }
    let idle: ReturnType<typeof setTimeout>
    const onScroll = () => {
      clearTimeout(idle)
      idle = setTimeout(settle, 120)
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(idle)
      track.removeEventListener('scroll', onScroll)
    }
  }, [photos.length, onIndexChange])

  useScrollLock()

  useEffect(() => {
    openerRef.current = document.activeElement
    closeRef.current?.focus()
    return () => {
      // The opener can be gone if the grid re-rendered; guard rather than
      // throwing on an element that is no longer in the document.
      const opener = openerRef.current
      if (!(opener instanceof HTMLElement) || !opener.isConnected) return

      // Focus has to go back — dropping it would strand a keyboard user at
      // the top of the document — but it should go back quietly. Leaving a
      // ring on the photo reads as "this thing is still selected" long
      // after the viewer has moved on.
      //
      // The mark is cleared by the first keypress, so the moment anyone
      // navigates by keyboard the rings behave normally again and the photo
      // they are standing on is visible.
      opener.setAttribute('data-focus-quiet', '')
      const clear = () => opener.removeAttribute('data-focus-quiet')
      opener.addEventListener('keydown', clear, { once: true })
      opener.addEventListener('blur', clear, { once: true })
      opener.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (closing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(-1)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        go(1)
      } else if (event.key === 'Tab') {
        // Keep Tab inside the dialog: without this the focus ring walks off
        // into the page behind, which is invisible and confusing.
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        )
        if (!focusables || focusables.length === 0) return
        const first = focusables[0]!
        const last = focusables[focusables.length - 1]!
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closing, dismiss, go])

  if (!photo) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      // The visible caption is gone, so the position in the set lives here.
      // A screen-reader user otherwise has no idea how many photos there
      // are or where in them they have got to.
      aria-label={`Pregled fotografije — ${categoryName}, ${index + 1} od ${photos.length}`}
      className="fixed inset-0 z-50"
    >
      <div ref={backdropRef} className="absolute inset-0 bg-bg-deep" />

      {/* `overscroll-contain` keeps a swipe past the last photo from handing
          the gesture to the page behind — on iOS that is the back-swipe. */}
      <div
        ref={trackRef}
        className="rail absolute inset-0 flex snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ marginInline: 0, paddingInline: 0 }}
      >
        {photos.map((slide, i) => {
          const ratio = aspectOf(slide)
          return (
            <div
              key={slide.id}
              // `snap-always`: a fast flick would otherwise carry past
              // several photographs at once, and in a gallery each one is
              // the thing you came for, not a step on the way somewhere.
              className="flex w-full shrink-0 snap-center snap-always items-center justify-center p-[var(--slide-pad-y)_var(--slide-pad-x)]"
            >
              <div
                // Only the photo that was opened carries the genie; the rest
                // are just slides.
                ref={i === openedAt ? figureRef : undefined}
                style={{
                  aspectRatio: ratio,
                  // Fit the photo to the space and let it grow into it.
                  // max-width and max-height alone only ever shrink, so a
                  // 640px original sat at 640px in the middle of a 1440px
                  // screen. Taking the smaller of "all the width there is"
                  // and "the width this photo would need to use all the
                  // height" gives the largest box that still fits.
                  width: `min(100%, calc((100svh - 2 * var(--slide-pad-y)) * ${ratio}))`,
                }}
                className="will-change-transform"
              >
                <picture>
                  <source type="image/avif" srcSet={srcSet(slide, 'avif')} sizes="100vw" />
                  <source type="image/webp" srcSet={srcSet(slide, 'webp')} sizes="100vw" />
                  <img
                    src={fallbackSrc(slide)}
                    srcSet={srcSet(slide, 'jpg')}
                    sizes="100vw"
                    alt={slide.alt}
                    width={slide.width}
                    height={slide.height}
                    // The neighbours are one swipe away and should already
                    // be there; the rest of the set can wait.
                    loading={Math.abs(i - openedAt) <= 1 ? 'eager' : 'lazy'}
                    className="size-full object-contain"
                  />
                </picture>
              </div>
            </div>
          )
        })}
      </div>

      <GlyphButton
        ref={closeRef}
        label="Zatvori"
        onClick={dismiss}
        className={`left-gutter top-lg ${CONTROLS.close}`}
      />
      {/* Hidden on a phone: swiping is the gesture there, and an arrow over
          each edge of the photograph costs width the photo can use. */}
      <GlyphButton
        label="Prethodna fotografija"
        onClick={() => go(-1)}
        className={`left-gutter top-1/2 hidden -translate-y-1/2 sm:block ${CONTROLS.prev}`}
      />
      <GlyphButton
        label="Sljedeća fotografija"
        onClick={() => go(1)}
        className={`right-gutter top-1/2 hidden -translate-y-1/2 sm:block ${CONTROLS.next}`}
      />
    </div>
  )
}

/**
 * A control drawn as a single glyph of the display face.
 *
 * Alfa Slab One has no arrow characters, but its guillemets and multiplication
 * sign are already the right shape — chunky, slab-cut, unmistakably the same
 * lettering as the section titles. Cheaper and more consistent than drawing
 * three SVGs that only approximate the face.
 */
const GLYPHS: Record<string, string> = {
  Zatvori: '×',
  'Prethodna fotografija': '‹',
  'Sljedeća fotografija': '›',
}

function GlyphButton({
  ref,
  label,
  className = '',
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>
  label: string
  className?: string
  onClick: () => void
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute z-10 font-display text-[clamp(3rem,8vw,6rem)] leading-none transition-[transform,opacity] duration-200 ease-out-soft hover:scale-110 active:scale-95 ${className}`}
    >
      <span aria-hidden="true">{GLYPHS[label]}</span>
    </button>
  )
}
