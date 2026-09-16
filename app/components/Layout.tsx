import type { ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'

export function Layout({
  children,
  overlayHeader = false,
}: {
  children: ReactNode
  overlayHeader?: boolean
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header overlay={overlayHeader} />
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
 * The stretched headline: words pushed to both edges of the column.
 *
 * Wraps to a normal left-aligned heading below the large breakpoint —
 * justified display type at phone width leaves gaps you could park in.
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
      className={`m-0 flex flex-wrap items-baseline gap-x-4 text-display max-lg:justify-start lg:flex-nowrap lg:justify-between ${className}`}
    >
      {words.map((word) => (
        <span key={word}>{word}</span>
      ))}
    </Tag>
  )
}
