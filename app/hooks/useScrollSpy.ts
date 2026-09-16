import { useEffect, useState } from 'react'

/**
 * Reports which section is currently in view, for the nav's active dot.
 *
 * Uses IntersectionObserver with a top margin equal to the header, so a
 * section counts as "current" once it clears the sticky bar rather than the
 * moment its first pixel appears. Falls back to no active item if the API is
 * missing — the nav still works, it just stops highlighting.
 */
export function useScrollSpy(ids: string[], headerHeight = 96): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0)
        }
        // Most-visible wins. Picking "first intersecting" instead makes the
        // dot flicker back to the previous section on every small scroll.
        let best: string | null = null
        let bestRatio = 0
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            best = id
            bestRatio = ratio
          }
        }
        setActive(best)
      },
      {
        rootMargin: `-${headerHeight}px 0px -40% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [ids.join(','), headerHeight])

  return active
}
