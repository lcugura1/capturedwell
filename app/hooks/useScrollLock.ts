import { useEffect } from 'react'

/**
 * Freezes the page behind a full-screen overlay.
 *
 * `overflow: hidden` on the body is the usual answer and it is not enough:
 * a drag inside the overlay still scrolled the page underneath it, on a
 * phone most of all. Pinning the body with `position: fixed` at a negative
 * offset is the version that actually holds — the document stops being
 * scrollable at all rather than merely being told not to advertise it.
 *
 * The offset has to be restored by hand afterwards, because a fixed body has
 * no scroll position of its own to go back to. `scrollRestoration` is left
 * alone; this is a within-page concern, not a navigation one.
 */
export function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    const { body } = document
    const y = window.scrollY
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflowY: body.style.overflowY,
    }

    body.style.position = 'fixed'
    body.style.top = `-${y}px`
    body.style.width = '100%'
    // Keeps the scrollbar's width reserved, so the page does not jump
    // sideways as it disappears — but only where a scrollbar takes width at
    // all. Phones draw theirs as an overlay over the content, so there is no
    // width to reserve, and forcing `scroll` on a pinned body instead painted
    // a permanent mustard bar down the right edge of the photo viewer. The
    // fix for a desktop jump had become a decoration on every phone.
    if (window.innerWidth > document.documentElement.clientWidth) {
      body.style.overflowY = 'scroll'
    }

    return () => {
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.width = previous.width
      body.style.overflowY = previous.overflowY
      // `instant`, not the page's smooth default: this is putting the
      // reader back where they were, not taking them somewhere.
      window.scrollTo({ top: y, behavior: 'instant' })
    }
  }, [active])
}
