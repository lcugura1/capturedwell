import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Photo as PhotoType } from '~/lib/gallery-types'
import { aspectOf, fallbackSrc, srcSet } from '~/lib/images'
import { genieKeyframes, type Neck } from '~/lib/genie'
import { useScrollLock } from '~/hooks/useScrollLock'
import { usePhotoGestures } from '~/hooks/usePhotoGestures'

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
 *   ← →   previous / next, stopping at both ends
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
  // A drag that passed the threshold: the photo is on its way off screen and
  // the component is waiting for the animation rather than for another
  // gesture. Its sign is the direction the finger was going.
  const [flungTo, setFlungTo] = useState<number | null>(null)

  /**
   * The photo on screen, for the gestures to measure against.
   *
   * `offsetWidth`/`offsetHeight` rather than a rect, because a rect of a
   * zoomed element is the zoomed box and the maths needs the resting one.
   * The slide centres its figure, so the middle of the frame is the middle of
   * the screen whatever the photograph's shape.
   */
  const currentRef = useRef<HTMLDivElement>(null)
  const getFrame = useCallback(() => {
    const el = currentRef.current
    if (!el || el.offsetWidth === 0) return null
    return {
      width: el.offsetWidth,
      height: el.offsetHeight,
      cx: window.innerWidth / 2,
      cy: window.innerHeight / 2,
    }
  }, [])

  const { dragY, zoom, handlers } = usePhotoGestures({
    index,
    getFrame,
    onDismiss: setFlungTo,
  })

  const scrollTo = useCallback(
    (next: number, behavior: ScrollBehavior) => {
      const track = trackRef.current
      if (!track) return
      // Claim the destination up front so the scroll listener does not
      // report it back as news — and tell the parent here, because that
      // listener now has nothing to say. Skip this and `index` never moves
      // for arrow and keyboard navigation, which leaves `go` computing
      // every jump from the same stale number.
      settledRef.current = next
      onIndexChange(next)
      track.scrollTo({ left: next * track.clientWidth, behavior })
    },
    [onIndexChange],
  )

  /**
   * Transform that puts the full-size figure back onto its thumbnail.
   *
   * The thumbnail is found in the grid by id rather than handed in as a
   * rect. Two reasons: a rect captured at click time is stale the moment
   * the page scrolls, and looking it up now means closing shrinks back
   * into the photo currently on screen after arrowing, not the one that
   * happened to be clicked first.
   *
   * The grid shows only the first few photos of a category, so past that
   * point there is no thumbnail to return to. Walking back to the nearest
   * photo that does have one lands the animation on the last tile in the
   * grid — which is where the viewer was opened from, and where the eye is
   * already expecting to end up.
   */
  const collapsed = useCallback(() => {
    const figure = figureRef.current
    const current = photos[index]
    if (!figure || !current) return null

    let thumb: Element | null = null
    for (let i = index; i >= 0 && !thumb; i--) {
      const candidate = photos[i]
      if (candidate)
        thumb = document.querySelector(`[data-photo-id="${CSS.escape(candidate.id)}"]`)
    }
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
    /**
     * Let go of the element once the arrival is over.
     *
     * `fill: both` is what makes the genie start from the thumbnail on the
     * very first frame, and it is also what keeps the animation asserting its
     * final keyframe forever after — a filling animation outranks the inline
     * style, so the zoom transform set on this same element was computed,
     * handed to React, and silently ignored. Cancelling on finish costs
     * nothing: the last keyframe is the resting state anyway.
     */
    const release = (animation: Animation) => {
      animation.onfinish = () => animation.cancel()
      return animation
    }

    release(
      figure.animate(genieKeyframes(neck), {
        duration: OPEN_MS,
        easing: EASE,
        fill: 'both',
      }),
    )
    release(
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
      ),
    )
    release(
      backdrop.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: OPEN_MS * 0.6,
        easing: 'linear',
        fill: 'both',
      }),
    )
    // Only on mount: re-running this on every swipe would replay the whole
    // open animation instead of just moving to the next photograph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (flungTo === null) return
    // Belt and braces: `transitionend` does not fire in a background tab, and
    // a dialog that never closes is worse than one that closes abruptly.
    const done = setTimeout(onClose, 260)
    return () => clearTimeout(done)
  }, [flungTo, onClose])

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

  // Stops at both ends rather than wrapping. The track cannot wrap — a
  // swipe past the last photo just rubber-bands — so an arrow that jumped
  // back to the first would be the one control on the page disagreeing with
  // the gesture beside it.
  const atStart = index === 0
  const atEnd = index === photos.length - 1

  const go = useCallback(
    (delta: number) => {
      if (photos.length === 0) return
      const next = index + delta
      if (next < 0 || next > photos.length - 1) return
      scrollTo(next, 'smooth')
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
      const landed = Math.max(
        0,
        Math.min(photos.length - 1, Math.round(track.scrollLeft / width)),
      )
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
    // Focus the dialog itself, not the × inside it.
    //
    // Focus has to move here — a keyboard user left standing in the page
    // behind an open dialog is lost, and Tab has nothing to trap. But the ×
    // is a control, and a focused control on this site draws a 2px ring, so
    // opening a photograph put a white box in the corner of every one. The
    // dialog is not a control: it takes focus, announces its label, and shows
    // nothing. The first Tab still lands on the ×, ring and all.
    dialogRef.current?.focus()
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
      tabIndex={-1}
      // The visible caption is gone, so the position in the set lives here.
      // A screen-reader user otherwise has no idea how many photos there
      // are or where in them they have got to.
      aria-label={`Pregled fotografije — ${categoryName}, ${index + 1} od ${photos.length}`}
      className="fixed inset-0 z-50 focus-visible:outline-none"
    >
      <div ref={backdropRef} className="absolute inset-0 bg-bg-deep" />

      {/* The layer the dismissal gesture moves. Separate from the track so
          dragging never touches the scroller's own offset — moving a scroll
          container while it is scrolling is how a gesture ends up fighting
          itself. */}
      <div
        className="absolute inset-0"
        style={{
          transform: flungTo
            ? `translateY(${flungTo * 100}svh)`
            : dragY
              ? // Shrinks a little as it goes, so the photograph reads as
                // receding rather than merely sliding off the edge.
                `translateY(${dragY}px) scale(${Math.max(0.82, 1 - Math.abs(dragY) / 1400)})`
              : undefined,
          opacity: flungTo ? 0 : 1,
          // No transition while the finger is down: the photo has to track it
          // frame for frame. The transition is for letting go — either the
          // spring back or the fling out.
          transition:
            dragY && flungTo === null
              ? 'none'
              : 'transform 250ms var(--ease-out-soft), opacity 250ms linear',
        }}
        {...handlers}
      >
        {/* `overscroll-contain` keeps a swipe past the last photo from handing
            the gesture to the page behind — on iOS that is the back-swipe.
            `photo-track` hands sideways gestures and pinches to the browser
            and leaves the vertical ones to the gesture hook. */}
        <div
          ref={trackRef}
          // Out of the tab order. Chrome makes scroll containers focusable so
          // they can be scrolled from the keyboard, which is the right
          // default and the wrong one here: it put a full-screen focus ring
          // between the viewer and the ×, for a scroller whose job the
          // dialog's own ← and → already do.
          tabIndex={-1}
          className={`rail absolute inset-0 flex snap-x snap-mandatory overscroll-x-contain ${
            zoom ? 'photo-track-zoomed' : 'photo-track'
          }`}
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
                  // Two different photos, two different jobs: the genie plays
                  // on the one the viewer opened, the gestures act on the one
                  // they are looking at. Usually the same slide, and after a
                  // swipe deliberately not.
                  ref={(node) => {
                    if (i === openedAt) figureRef.current = node
                    if (i === index) currentRef.current = node
                  }}
                  style={{
                    aspectRatio: ratio,
                    // Fit the photo to the space and let it grow into it.
                    // max-width and max-height alone only ever shrink, so a
                    // 640px original sat at 640px in the middle of a 1440px
                    // screen. Taking the smaller of "all the width there is"
                    // and "the width this photo would need to use all the
                    // height" gives the largest box that still fits.
                    width: `min(100%, calc((100svh - 2 * var(--slide-pad-y)) * ${ratio}))`,
                    // Only the photo on screen carries a zoom; the neighbours
                    // are at rest, ready to be swiped to at their own scale.
                    ...(zoom && i === index
                      ? {
                          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                          transition: 'transform 200ms var(--ease-out-soft)',
                        }
                      : {}),
                  }}
                  className="will-change-transform"
                >
                  <picture>
                    <source
                      type="image/avif"
                      srcSet={srcSet(slide, 'avif')}
                      sizes="100vw"
                    />
                    <source
                      type="image/webp"
                      srcSet={srcSet(slide, 'webp')}
                      sizes="100vw"
                    />
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
      </div>

      <GlyphButton
        label="Zatvori"
        onClick={dismiss}
        className={`left-gutter top-lg ${CONTROLS.close}`}
      />
      {/* Hidden on a phone: swiping is the gesture there, and an arrow over
          each edge of the photograph costs width the photo can use. Gone
          entirely at the ends rather than dimmed — there is nowhere to go,
          and a control that cannot act should not be in the way of one that
          can. */}
      {!atStart && (
        <GlyphButton
          label="Prethodna fotografija"
          onClick={() => go(-1)}
          className={`left-gutter top-1/2 hidden -translate-y-1/2 sm:block ${CONTROLS.prev}`}
        />
      )}
      {!atEnd && (
        <GlyphButton
          label="Sljedeća fotografija"
          onClick={() => go(1)}
          className={`right-gutter top-1/2 hidden -translate-y-1/2 sm:block ${CONTROLS.next}`}
        />
      )}
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
