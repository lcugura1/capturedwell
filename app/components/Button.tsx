import { Link } from 'react-router'
import type { ReactNode } from 'react'

/**
 * Pill controls, exactly as specified on the style tile.
 *
 * `solid` is the page's one loud element; `outline` is everything else.
 * Focus is left to the global :focus-visible rule so every control on the
 * site rings identically — a button that invents its own focus state is a
 * bug, not a variant.
 */
const VARIANTS = {
  solid: 'bg-solid text-bg hover:bg-solid-hover active:bg-solid-active',
  outline:
    'border border-line-strong text-ink hover:border-ink active:bg-surface',
} as const

type Variant = keyof typeof VARIANTS

const BASE =
  'inline-flex h-12 items-center gap-xs rounded-pill px-md text-label ' +
  'transition-colors duration-150 ease-out-soft disabled:opacity-40'

export function ButtonLink({
  to,
  href,
  variant = 'solid',
  children,
  ...rest
}: {
  to?: string
  href?: string
  variant?: Variant
  children: ReactNode
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const className = `${BASE} ${VARIANTS[variant]}`
  if (to) {
    return (
      <Link to={to} className={className} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  )
}

/** Circular icon-only control — lightbox navigation, mostly. */
export function IconButton({
  label,
  variant = 'outline',
  children,
  ...rest
}: {
  label: string
  variant?: Variant
  children: ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`inline-flex size-14 items-center justify-center rounded-pill transition-colors duration-150 ease-out-soft ${VARIANTS[variant]}`}
      {...rest}
    >
      {children}
    </button>
  )
}
