import { useCallback, useState, type ReactNode } from 'react'
import { mailtoHref } from '~/lib/site'

/**
 * A mail link whose href does not exist until someone interacts with it.
 *
 * Rendered as an <a> with no href, it is not focusable — so the keyboard
 * path would silently vanish. Instead it carries the href from the first
 * pointer-enter or focus, and falls back to navigating on activation for
 * anyone who gets there without either (a screen-reader click, mostly).
 */
export function MailLink({
  subject,
  className,
  children,
}: {
  subject?: string
  className?: string
  children: ReactNode
}) {
  const [href, setHref] = useState<string | undefined>(undefined)
  const reveal = useCallback(() => setHref(mailtoHref(subject)), [subject])

  return (
    <a
      href={href}
      className={className}
      onPointerEnter={reveal}
      onFocus={reveal}
      onClick={(event) => {
        if (!href) {
          event.preventDefault()
          window.location.href = mailtoHref(subject)
        }
      }}
    >
      {children}
    </a>
  )
}
