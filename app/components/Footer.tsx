import { SITE, WORDMARK } from '~/lib/site'
import { MailLink } from './MailLink'

/**
 * Wordmark and credit on the left, the ways to reach Damir on the right.
 *
 * There was a fourth item here: a near-invisible grey dot linking to
 * `/admin`. Both are gone — the dashboard it led to was replaced by the
 * Drive sync, and a hidden link to a route that no longer exists is worse
 * than no link at all.
 */
export function Footer() {
  return (
    <footer className="flex flex-col items-start justify-between gap-lg border-t border-line px-gutter pb-lg pt-xl sm:flex-row sm:items-center">
      <div className="flex items-baseline gap-sm">
        <span className="text-mark">{WORDMARK}</span>
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
      </div>
    </footer>
  )
}
