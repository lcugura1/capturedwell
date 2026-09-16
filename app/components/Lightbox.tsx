import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Photo as PhotoType } from '~/lib/gallery-types'
import { aspectOf, fallbackSrc, srcSet } from '~/lib/images'

/** Matches the retro palette used by section titles. */
const CONTROLS = {
  close: 'text-retro-teal',
  prev: 'text-retro-mustard',
  next: 'text-retro-rust',
} as const

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const OPEN_MS = 460
const CLOSE_MS = 320

function prefersReducedMotion() {
  return (
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Full-screen photo view that grows out of the thumbnail it was opened from.
 *
 * The animation is FLIP: the photo is laid out at its final size first, then
 * transformed back onto the rect of the thumbnail that was clicked and
 * released. Only `transform` and `opacity` move, so it runs on the
 * compositor and never reflows a full-bleed photograph mid-flight.
 *
 * The genie part is the middle keyframe: horizontal distance and width close
 * faster than vertical, so the photo stretches upward out of its cell before
 * settling instead of scaling uniformly. Closing replays it in reverse and
 * unmounts on finish, which is why `closing` exists rather than the parent
 * dropping the component immediately.
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
  const figureRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<Element | null>(null)
  const [closing, setClosing] = useState(false)
  const photo = photos[index]

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
    if (!figure || !photo) return null
    const thumb = document.querySelector(`[data-photo-id="${CSS.escape(photo.id)}"]`)
    if (!thumb) return null
    const from = thumb.getBoundingClientRect()
    const to = figure.getBoundingClientRect()
    if (to.width === 0 || to.height === 0 || from.width === 0) return null
    return {
      dx: from.left - to.left,
      dy: from.top - to.top,
      sx: from.width / to.width,
      sy: from.height / to.height,
    }
  }, [photo])

  useLayoutEffect(() => {
    const figure = figureRef.current
    const backdrop = backdropRef.current
    const from = collapsed()
    if (!figure || !backdrop || !from || prefersReducedMotion()) return

    const { dx, dy, sx, sy } = from
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
    // Only on mount: re-running this on every arrow press would replay the
    // whole open animation instead of just swapping the photograph.
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
    const { dx, dy, sx, sy } = to
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
      onIndexChange((index + delta + photos.length) % photos.length)
    },
    [index, photos.length, onIndexChange],
  )

  useEffect(() => {
    openerRef.current = document.activeElement
    closeRef.current?.focus()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = overflow
      // The opener can be gone if the grid re-rendered; guard rather than
      // throwing on an element that is no longer in the document.
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
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
      aria-label="Pregled fotografije"
      className="fixed inset-0 z-50"
    >
      <div ref={backdropRef} className="absolute inset-0 bg-bg-deep" />

      <div className="absolute inset-0 flex items-center justify-center p-header">
        <div ref={figureRef} className="max-h-full max-w-full will-change-transform">
          <picture>
            <source type="image/avif" srcSet={srcSet(photo, 'avif')} sizes="90vw" />
            <source type="image/webp" srcSet={srcSet(photo, 'webp')} sizes="90vw" />
            <img
              src={fallbackSrc(photo)}
              srcSet={srcSet(photo, 'jpg')}
              sizes="90vw"
              alt={photo.alt}
              width={photo.width}
              height={photo.height}
              style={{ aspectRatio: aspectOf(photo) }}
              className="max-h-[calc(100svh-2*var(--spacing-header))] max-w-full object-contain"
            />
          </picture>
        </div>
      </div>

      <GlyphButton
        ref={closeRef}
        label="Zatvori"
        onClick={dismiss}
        className={`left-gutter top-lg ${CONTROLS.close}`}
      >
        ×
      </GlyphButton>
      <GlyphButton
        label="Prethodna fotografija"
        onClick={() => go(-1)}
        className={`left-gutter top-1/2 -translate-y-1/2 ${CONTROLS.prev}`}
      >
        ‹
      </GlyphButton>
      <GlyphButton
        label="Sljedeća fotografija"
        onClick={() => go(1)}
        className={`right-gutter top-1/2 -translate-y-1/2 ${CONTROLS.next}`}
      >
        ›
      </GlyphButton>

      <p className="absolute inset-x-0 bottom-lg m-0 flex items-center justify-center gap-md text-caption font-medium text-ink-subtle">
        <span>
          {categoryName} · {index + 1} / {photos.length}
        </span>
        <span aria-hidden="true">·</span>
        <span>← → listanje · esc zatvaranje</span>
      </p>
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
function GlyphButton({
  ref,
  label,
  children,
  className = '',
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>
  label: string
  children: string
  className?: string
  onClick: () => void
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute font-display text-[clamp(48px,8vw,96px)] leading-none transition-[transform,opacity] duration-200 ease-out-soft hover:scale-110 active:scale-95 ${className}`}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
