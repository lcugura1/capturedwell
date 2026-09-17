import { SITE } from '~/lib/site'
import { MailLink } from './MailLink'

/**
 * The admin entry point is the grey dot on the right.
 *
 * It is deliberately almost invisible, but that is presentation, not
 * security: /admin sits behind Cloudflare Access, which stops unauthorised
 * requests at the edge before they reach the app. Anyone who finds the dot
 * gets a login screen, which is the correct outcome.
 *
 * A plain <a>, not a <Link>: /admin is the one route outside the single
 * page, and it should be a real navigation rather than a client-side one.
 */
export function Footer() {
  return (
    <footer className="flex flex-col items-start justify-between gap-lg border-t border-line px-gutter pb-lg pt-xl sm:flex-row sm:items-center">
      <div className="flex items-baseline gap-sm">
        <span className="text-mark">{SITE.name}.</span>
        <span className="text-label text-ink-subtle">
          {SITE.owner} · {SITE.role}
        </span>
      </div>
      <div className="flex items-center gap-7 text-nav">
        <a
          href={SITE.instagram.url}
          rel="me noreferrer"
          target="_blank"
          className="text-ink-muted transition-colors duration-150 ease-out-soft hover:text-ink"
        >
          instagram
        </a>
        <MailLink className="text-ink-muted transition-colors duration-150 ease-out-soft hover:text-ink">
          e-mail
        </MailLink>
        <span className="text-ink-subtle">© {new Date().getFullYear()}</span>
        <a href="/admin" aria-label="Administracija" className="flex size-6 items-center justify-center">
          <span aria-hidden="true" className="size-[0.3125rem] rounded-pill bg-faint" />
        </a>
      </div>
    </footer>
  )
}
