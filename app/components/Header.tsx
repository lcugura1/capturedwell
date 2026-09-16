import { NavLink, Link } from 'react-router'
import { Logo } from './Logo'
import { Dot } from './Dot'

const NAV = [
  { to: '/galerija', label: 'galerija' },
  { to: '/o-meni', label: 'o meni' },
  { to: '/kontakt', label: 'kontakt' },
]

/**
 * `overlay` drops the header onto the hero photo instead of giving it its
 * own 96px band. Used only on the homepage, where the photo runs to the top
 * edge of the viewport.
 */
export function Header({ overlay = false }: { overlay?: boolean }) {
  return (
    <header
      className={
        overlay
          ? 'absolute inset-x-0 top-0 z-10 flex items-center justify-between px-gutter py-xl'
          : 'flex h-header items-center justify-between px-gutter'
      }
    >
      <Link to="/" className="h-[18px] text-ink" aria-label="capturedwell — naslovnica">
        <Logo className="block h-full" />
      </Link>
      <nav className="flex items-center gap-9 text-nav">
        {NAV.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-xs transition-colors duration-150 ease-out-soft ${
                isActive || overlay ? 'text-ink' : 'text-ink-muted hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <Dot size="sm" className="bg-ink" />}
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
