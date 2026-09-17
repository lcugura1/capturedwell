import { useEffect } from 'react'

/**
 * Marks elements as revealed once they scroll into view.
 *
 * One observer for the whole page rather than one per element: the page is
 * a single document with a few dozen candidates, and a shared observer is
 * both cheaper and easier to reason about than a hook instance per section.
 *
 * Two opt-ins:
 *   data-reveal                  this element rises into place
 *   data-reveal-stagger="0.08"   its children do, one after another
 *
 * A staggered container is not itself hidden — only its children are, each
 * with its own delay, and each observed in its own right. Marking the
 * container instead would leave the children carrying the hidden starting
 * state with nothing to ever clear it.
 *
 * Elements re-arm once they are fully off screen, so the animation plays
 * whichever way the page is being read rather than only on the first trip
 * down. Fully off screen is the important part: un-arming anything still
 * visible would fade out something the reader is looking at.
 *
 * A second observer watches for `hidden` being toggled. The gallery keeps
 * all four category grids in the DOM and hides the inactive ones, and an
 * element observed while `display: none` does not reliably report itself
 * once it is shown — one row per switch was staying invisible in view.
 * Rescanning on that attribute closes it, and covers any other content that
 * appears after mount.
 */
export function useReveal() {
  useEffect(() => {
    const roots = document.querySelectorAll<HTMLElement>('[data-reveal-stagger]')
    for (const root of roots) {
      const step = Number(root.dataset.revealStagger) || 0
      Array.from(root.children).forEach((child, i) => {
        if (!(child instanceof HTMLElement)) return
        child.setAttribute('data-reveal', '')
        child.style.setProperty('--reveal-delay', `${(i * step).toFixed(3)}s`)
      })
    }

    const targets = document.querySelectorAll<HTMLElement>('[data-reveal]')
    if (targets.length === 0) return

    // Without IntersectionObserver nothing would ever be marked, and the
    // CSS starting state would hide the page. Reveal everything at once.
    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((el) => el.setAttribute('data-revealed', ''))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.setAttribute('data-revealed', '')
          else entry.target.removeAttribute('data-revealed')
        }
      },
      // No margin, and the observation is kept. The margin used to pull the
      // trigger slightly early, which is a nice touch in one direction and
      // wrong in the other: it also reports an element as gone while it is
      // still visible in the bottom of the screen, which would un-arm
      // something the reader can see.
      { rootMargin: '0px', threshold: 0 },
    )
    const scan = () => {
      for (const el of document.querySelectorAll<HTMLElement>('[data-reveal]')) {
        observer.observe(el)
        if (el.hasAttribute('data-revealed')) continue
        // Measure rather than trust the observer here. `observe()` on an
        // element it already holds is a no-op, so an element judged
        // off-screen while its category was `display: none` never gets a
        // second opinion — one gallery row stayed invisible in plain view
        // on every category switch.
        const box = el.getBoundingClientRect()
        if (box.width > 0 && box.bottom > 0 && box.top < window.innerHeight) {
          el.setAttribute('data-revealed', '')
        }
      }
    }
    scan()

    const changes = new MutationObserver(scan)
    changes.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden'],
    })

    return () => {
      observer.disconnect()
      changes.disconnect()
    }
  }, [])
}
