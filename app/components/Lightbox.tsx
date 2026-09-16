import { useCallback, useEffect, useRef } from 'react'
import type { Photo as PhotoType } from '~/lib/gallery-types'
import { aspectOf, fallbackSrc, srcSet } from '~/lib/images'
import { ChevronLeft, ChevronRight, Close } from '~/components/icons'
import { Dot } from '~/components/Dot'

/**
 * Full-screen photo view.
 *
 * Keyboard is a first-class path here, not an afterthought — a gallery you
 * cannot arrow through is broken for anyone not using a mouse:
 *   ← →   previous / next, wrapping at both ends
 *   Esc   close
 *   Tab   cycles inside the dialog only
 *
 * Focus moves to the close button on open and returns to whatever opened the
 * dialog on close, so the reading position is never lost. Background scroll
 * is frozen while it is up, otherwise dismissing it lands you somewhere else
 * on the page.
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
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<Element | null>(null)
  const photo = photos[index]

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
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
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
  }, [go, onClose])

  if (!photo) return null

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Pregled fotografije"
      className="fixed inset-0 z-50 bg-bg-deep"
    >
      <div className="absolute inset-0 flex items-center justify-center p-header">
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
            className="max-h-full max-w-full object-contain"
          />
        </picture>
      </div>

      <div className="absolute inset-x-0 top-0 flex h-header items-center justify-between px-gutter">
        <div className="flex items-center gap-sm text-label">
          <span className="flex items-center gap-2.5">
            <Dot size="md" className="bg-ink" />
            <span>{categoryName}</span>
          </span>
          <span className="text-ink-subtle">
            {index + 1} / {photos.length}
          </span>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Zatvori"
          className="flex size-12 items-center justify-center rounded-pill border border-line-strong text-ink transition-colors duration-150 ease-out-soft hover:border-ink"
        >
          <Close className="size-[18px]" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Prethodna fotografija"
        className="absolute left-gutter top-1/2 flex size-14 -translate-y-1/2 items-center justify-center rounded-pill border border-line-strong text-ink transition-colors duration-150 ease-out-soft hover:border-ink"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Sljedeća fotografija"
        className="absolute right-gutter top-1/2 flex size-14 -translate-y-1/2 items-center justify-center rounded-pill border border-line-strong text-ink transition-colors duration-150 ease-out-soft hover:border-ink"
      >
        <ChevronRight className="size-5" />
      </button>

      <p className="absolute inset-x-0 bottom-0 m-0 flex h-header items-center justify-center gap-md text-caption font-medium text-ink-subtle">
        {/* The canvas replaced the two chevron glyphs with literal arrows.
            They read the same at 12px and cost two fewer inline SVGs. */}
        <span>← → listanje</span>
        <Dot size="xs" />
        <span>esc zatvaranje</span>
      </p>
    </div>
  )
}
