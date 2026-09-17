import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router'
import type { LinksFunction } from 'react-router'
import { SITE } from '~/lib/site'
import { Layout as SiteLayout } from '~/components/Layout'
import { ButtonLink } from '~/components/Button'
import { GlassFilter } from '~/components/GlassFilter'
import './styles/theme.css'
import fontUrl from '/fonts/jost-latin-ext.woff2?url'
import displayFontUrl from '/fonts/alfa-slab-latin-ext.woff2?url'

export const links: LinksFunction = () => [
  // Self-hosted: one round-trip fewer than Google Fonts, and no visitor IP
  // handed to a third party. Preloaded because the wordmark and every
  // heading depend on it — a late font is a visible reflow.
  { rel: 'preload', href: fontUrl, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  // The mark is the `c` from Damir's logo, not the wordmark: at 16px a
  // 6.7:1 wordmark is three pixels tall and reads as a smudge.
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
  { rel: 'icon', href: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Paints the browser chrome to match the page on mobile, so the
            dark site does not sit in a white frame. */}
        <meta name="theme-color" content="#0c0c0c" />
        {/* Gates the reveal animations. Their starting state is
            `opacity: 0`, so it must never reach a visitor whose JavaScript
            does not arrive — this runs before first paint and only when
            scripting is on. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        <Meta />
        <Links />
        <style
          // Inlined rather than imported so the face is defined in the first
          // HTML, before any stylesheet has finished arriving.
          dangerouslySetInnerHTML={{
            __html:
              `@font-face{font-family:'Jost';src:url('${fontUrl}') format('woff2');font-weight:400 700;font-style:normal;font-display:swap;}` +
              // Not preloaded, unlike Jost: it dresses three section titles,
              // all below the fold, and an early request for it would
              // compete with the hero photograph, which is the LCP.
              `@font-face{font-family:'Alfa Slab One';src:url('${displayFontUrl}') format('woff2');font-weight:400;font-style:normal;font-display:swap;}`,
          }}
        />
      </head>
      <body>
        <GlassFilter />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  return <Outlet />
}

export function ErrorBoundary({ error }: { error: unknown }) {
  const is404 = isRouteErrorResponse(error) && error.status === 404
  return (
    <SiteLayout>
      <section className="flex flex-col items-center gap-xl px-gutter py-3xl text-center">
        <h1 className="m-0 text-h1">{is404 ? 'nema ničega ovdje.' : 'nešto je puklo.'}</h1>
        <p className="m-0 max-w-[32.5rem] text-lead text-ink-body">
          {is404
            ? 'Stranica koju tražiš ne postoji ili je preseljena.'
            : `Dogodila se greška. Ako se ponovi, javi se na ${SITE.email.user}@${SITE.email.domain}.`}
        </p>
        <ButtonLink to="/">natrag na naslovnicu</ButtonLink>
      </section>
    </SiteLayout>
  )
}
