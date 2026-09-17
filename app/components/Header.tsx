import { useEffect, useId, useRef, useState } from 'react'
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
 * Below `sm` the three links collapse into a button. Not for fashion: the
 * wordmark is 6.7:1, so at a phone's width the mark and three labels ran
 * sixty pixels off the edge.
 *
 * `active` comes from the scroll spy rather than from the URL — the hash
 * only updates on click, but the dot should follow the actual scroll too.
 */
export function Header({ active }: { active: string | null }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const burgerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.6)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // The panel is a menu, not a modal: it should get out of the way on Esc,
  // on a click anywhere else, and as soon as the viewport is wide enough
  // that the full nav is back — otherwise it stays open and invisible,
  // holding focus somewhere the user cannot see.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      burgerRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || burgerRef.current?.contains(target)) return
      setOpen(false)
    }
    const wide = window.matchMedia('(min-width: 40rem)')
    const onWide = () => wide.matches && setOpen(false)

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    wide.addEventListener('change', onWide)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      wide.removeEventListener('change', onWide)
    }
  }, [open])

  const solid = scrolled || open

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ease-out-soft ${
        solid ? 'bg-bg/95 backdrop-blur-sm' : 'bg-transparent'
      }`}
    >
      <div className="flex h-header items-center justify-between px-gutter">
        <a
          href="#vrh"
          onClick={() => setOpen(false)}
          className="h-3.5 text-ink sm:h-[1.125rem]"
          aria-label="capturedwell — na vrh"
        >
          <Logo className="block h-full" />
        </a>

        <nav className="hidden items-center gap-9 text-nav sm:flex">
          {SECTIONS.map(({ id, label }) => (
            <NavLink key={id} id={id} label={label} active={active === id} />
          ))}
        </nav>

        <button
          ref={burgerRef}
          type="button"
          onClick={() => setOpen((was) => !was)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? 'Zatvori izbornik' : 'Otvori izbornik'}
          // 44px of tap target around a 20px glyph: the icon is the size it
          // should look, the button is the size a thumb needs.
          className="-mr-2.5 flex size-11 items-center justify-center text-ink sm:hidden"
        >
          <Burger open={open} />
        </button>
      </div>

      <div
        id={panelId}
        ref={panelRef}
        hidden={!open}
        className="border-t border-line px-gutter pb-md sm:hidden"
      >
        <nav className="flex flex-col">
          {SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={() => setOpen(false)}
              aria-current={active === id ? 'true' : undefined}
              className={`flex min-h-12 items-center gap-xs text-lead transition-colors duration-150 ease-out-soft ${
                active === id ? 'text-ink' : 'text-ink-muted'
              }`}
            >
              {active === id && <Dot size="md" className="bg-ink" />}
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  )
}

function NavLink({ id, label, active }: { id: string; label: string; active: boolean }) {
  return (
    <a
      href={`#${id}`}
      aria-current={active ? 'true' : undefined}
      className={`flex items-center gap-xs transition-colors duration-150 ease-out-soft ${
        active ? 'text-ink' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {active && <Dot size="sm" className="bg-ink" />}
      <span>{label}</span>
    </a>
  )
}

/**
 * Three bars that fold into a cross.
 *
 * Drawn rather than swapped for a second icon so the two states are the
 * same three elements moving, which is what makes the change read as one
 * thing rather than a flicker. `aria-hidden` throughout: the button already
 * carries the label and the state.
 */
function Burger({ open }: { open: boolean }) {
  // 2px, not rem: this is a hairline, a rendering detail rather than a size
  // anyone reads. Growing it with the reader's font setting would thicken
  // the icon without making it any clearer.
  const bar = 'absolute h-[2px] w-5 bg-current transition-transform duration-200 ease-out-soft'
  return (
    <span aria-hidden="true" className="relative flex size-5 items-center justify-center">
      <span className={`${bar} ${open ? 'rotate-45' : '-translate-y-1.5'}`} />
      <span
        className={`${bar} transition-opacity duration-150 ${open ? 'opacity-0' : 'opacity-100'}`}
      />
      <span className={`${bar} ${open ? '-rotate-45' : 'translate-y-1.5'}`} />
    </span>
  )
}
