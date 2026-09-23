import type { ReactNode } from 'react'
import { Footer } from './Footer'
import { Logo } from './Logo'

/**
 * The frame every page sits in: logo, content, footer.
 *
 * No section nav of its own — the anchors live in the sticky Header, which
 * belongs to the one page that has sections.
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-header items-center px-gutter">
        <a
          href="/"
          className="h-[1.125rem] text-ink"
          aria-label="capturedwell — naslovnica"
        >
          <Logo className="block h-full" />
        </a>
      </header>
      <main className="flex-1">{children}</main>
      <Footer />
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
