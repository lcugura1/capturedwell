import { Dot } from './Dot'
import { MailLink } from './MailLink'
import { SITE, WORDMARK } from '~/lib/site'

/**
 * The colophon that closes the page.
 *
 * Centred, and a column rather than a bar. A footer split left and right is
 * the shape of a site with somewhere else to go; this one has nowhere — the
 * gallery, the biography and the contact details are all above it, and the
 * menu scrolls back up. What is left is a signature, and a signature sits in
 * the middle of the page.
 *
 * The wordmark carries it. The page opens on the mark stretched across the
 * full width and closes on it at a quarter of that size, which is the one
 * thing the footer can say that is not already said above. Everything under
 * it steps down hard — credit, then the two ways to reach Damir, then the
 * year, each quieter than the last.
 *
 * The dot between his name and his trade is the full stop from the logo,
 * doing the job it is documented for. It is the only ornament here; the
 * boldness is spent on the mark.
 *
 * There was a fifth item: a near-invisible grey dot linking to `/admin`.
 * Both are gone — the dashboard it led to was replaced by the Drive sync,
 * and a hidden link to a route that no longer exists is worse than none.
 */
export function Footer() {
  return (
    <footer className="flex flex-col items-center gap-lg border-t border-line px-gutter pb-xl pt-xl text-center">
      <div className="flex flex-col items-center gap-3">
        {/* `block` so the line box belongs to the mark alone: the underscore
            descends below the baseline, and inline it dragged the credit
            beneath it closer than the spacing says. */}
        <span className="block text-colophon text-ink">{WORDMARK}</span>
        <span className="flex items-center gap-2.5 text-label text-ink-subtle">
          {SITE.owner}
          <Dot size="xs" />
          {SITE.role}
        </span>
      </div>

      <div className="flex flex-col items-center gap-md">
        <nav aria-label="Poveznice" className="flex items-center gap-7 text-nav">
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
        </nav>
        {/* On its own line, and smaller. Beside the links it read as a third
            one, and a year is not somewhere to click. */}
        <span className="text-caption text-ink-subtle">© {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
