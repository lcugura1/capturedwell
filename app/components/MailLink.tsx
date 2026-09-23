import { useSyncExternalStore, type ReactNode } from 'react'
import { mailtoHref } from '~/lib/site'

/** Nothing ever changes after hydration, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {}
const inTheBrowser = () => true
const onTheServer = () => false

/**
 * A mail link whose href is absent from the served HTML and present in the
 * page.
 *
 * The address is visible on the contact section — the design calls for that
 * — so this is not real obfuscation. What it buys is that the prerendered
 * document contains no `mailto:` href, which is the pattern the cheap
 * harvesters grep for. Anything that renders the page and reads text will
 * still find the address, and that is an accepted trade.
 *
 * The href arrives on hydration, and that timing is the whole point: the
 * server snapshot says "not yet", so the file on the CDN is clean, while
 * every visitor gets an ordinary link the moment React takes over.
 *
 * `useSyncExternalStore` rather than an effect that sets state. It is the
 * sanctioned way to render one thing on the server and another in the
 * browser, it costs no extra render, and it does not trip the rule against
 * setting state synchronously in an effect.
 *
 * It used to wait for a pointer to enter or the element to take focus, which
 * sounded careful and was broken. An `<a>` with no href is not focusable, so
 * it was never in the tab order, so the focus that was meant to reveal the
 * address could not happen — and "pošalji e-mail", the one thing the page
 * asks a visitor to do, was unreachable from a keyboard entirely. The click
 * fallback below stays, for a click that somehow lands before hydration.
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
  const hydrated = useSyncExternalStore(subscribeToNothing, inTheBrowser, onTheServer)
  const href = hydrated ? mailtoHref(subject) : undefined

  return (
    <a
      href={href}
      className={className}
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
