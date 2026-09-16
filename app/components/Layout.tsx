import type { ReactNode } from 'react'
import { Footer } from './Footer'
import { Logo } from './Logo'

/**
 * Minimal chrome for /admin — the one page outside the single-page site.
 *
 * It deliberately has no section nav: the anchors belong to the public page
 * and would scroll to nothing here.
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-header items-center px-gutter">
        <a href="/" className="h-[18px] text-ink" aria-label="capturedwell — naslovnica">
          <Logo className="block h-full" />
        </a>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

/** The small dotted label that opens most sections. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-label text-ink-subtle">
      <span aria-hidden="true" className="size-[6px] rounded-pill bg-ink-subtle" />
      <span>{children}</span>
    </div>
  )
}

/**
 * The display headline.
 *
 * Two words get pushed to opposite edges of the column; one word is simply
 * left-aligned. The canvas uses both forms, and a lone word under
 * `justify-between` would sit left anyway — stating it explicitly stops the
 * layout depending on a flex accident.
 *
 * Below the large breakpoint it always falls back to left-aligned: justified
 * display type at phone width leaves gaps you could park in.
 */
export function StretchedHeading({
  words,
  as: Tag = 'h1',
  className = '',
}: {
  words: string[]
  as?: 'h1' | 'h2'
  className?: string
}) {
  return (
    <Tag
      className={`m-0 flex flex-wrap items-baseline gap-x-4 text-display max-lg:justify-start lg:flex-nowrap ${
        words.length > 1 ? 'lg:justify-between' : 'lg:justify-start'
      } ${className}`}
    >
      {words.map((word) => (
        <span key={word}>{word}</span>
      ))}
    </Tag>
  )
}
