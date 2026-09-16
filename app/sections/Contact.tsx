import { StretchedHeading } from '~/components/Layout'
import { MailLink } from '~/components/MailLink'
import { Mail } from '~/components/icons'
import { SITE, EMAIL_TEXT } from '~/lib/site'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-md border-t border-line py-5">
      <span className="text-label text-ink-subtle">{label}</span>
      <span className="text-field">{children}</span>
    </div>
  )
}

/**
 * The closing section of the page.
 *
 * No form: that was a deliberate call. A form means a server endpoint, spam
 * handling and a delivery service to keep alive, and it buys nothing a mail
 * client does not already do better.
 */
export function Contact() {
  return (
    <section
      id="kontakt"
      className="flex scroll-mt-header flex-col gap-xl px-gutter pb-3xl pt-3xl"
    >
      <StretchedHeading as="h2" words={['javi se']} />

      <div className="grid grid-cols-1 gap-md lg:grid-cols-12">
        <div className="flex flex-col items-start gap-xl lg:col-span-5">
          <p className="m-0 text-lead text-pretty">
            Za termine, upite i cijene najbrže je e-mailom.
          </p>
          <MailLink
            subject="Upit preko capturedwell.hr"
            className="inline-flex h-12 items-center gap-2.5 rounded-pill bg-solid px-md text-label text-bg transition-colors duration-150 ease-out-soft hover:bg-solid-hover"
          >
            <Mail className="size-4" />
            <span>pošalji e-mail</span>
          </MailLink>
        </div>

        <div className="flex flex-col lg:col-span-6 lg:col-start-7">
          <Row label="e-mail">
            <MailLink className="text-ink hover:text-ink-muted">{EMAIL_TEXT}</MailLink>
          </Row>
          {SITE.phone && (
            <Row label="telefon">
              <a href={`tel:${SITE.phone.replace(/\s/g, '')}`} className="text-ink">
                {SITE.phone}
              </a>
            </Row>
          )}
          <Row label="instagram">
            <a
              href={SITE.instagram.url}
              target="_blank"
              rel="me noreferrer"
              className="text-ink hover:text-ink-muted"
            >
              {SITE.instagram.handle}
            </a>
          </Row>
          <div className="border-t border-line" />
        </div>
      </div>
    </section>
  )
}
