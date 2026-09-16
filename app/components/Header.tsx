import { useEffect, useState } from 'react'
import { Logo } from './Logo'
import { Dot } from './Dot'

export const SECTIONS = [
  { id: 'galerija', label: 'galerija' },
  { id: 'o-meni', label: 'o meni' },
  { id: 'kontakt', label: 'kontakt' },
] as const

/**
 * Sticky header for the single page.
 *
 * It has to be sticky: on a one-page site the menu is the only way to move
 * between sections, and a header that scrolls away strands the visitor at
 * the bottom. Over the hero it stays transparent as the canvas draws it;
 * past the hero it takes a background, otherwise white nav text lands on
 * whatever photograph happens to be underneath.
 *
 * `active` comes from the scroll spy rather than from the URL — the hash
 * only updates on click, but the dot should follow the actual scroll too.
 */
export function Header({ active }: { active: string | null }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex h-header items-center justify-between px-gutter transition-colors duration-300 ease-out-soft ${
        scrolled ? 'bg-bg/90 backdrop-blur-sm' : 'bg-transparent'
      }`}
    >
      <a href="#vrh" className="h-[18px] text-ink" aria-label="capturedwell — na vrh">
        <Logo className="block h-full" />
      </a>
      <nav className="flex items-center gap-9 text-nav">
        {SECTIONS.map(({ id, label }) => {
          const isActive = active === id
          return (
            <a
              key={id}
              href={`#${id}`}
              aria-current={isActive ? 'true' : undefined}
              className={`flex items-center gap-xs transition-colors duration-150 ease-out-soft ${
                isActive ? 'text-ink' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {isActive && <Dot size="sm" className="bg-ink" />}
              <span>{label}</span>
            </a>
          )
        })}
      </nav>
    </header>
  )
}
