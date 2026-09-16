import type { Config } from '@react-router/dev/config'
import { CATEGORIES } from './app/lib/categories'

export default {
  // No server runtime: the public site is static files on Cloudflare Pages.
  // Everything dynamic (uploads, auth) lives in the Worker under /api.
  ssr: false,
  // Every public route ships as real HTML so search engines and slow
  // connections never wait on JavaScript.
  prerender: [
    '/',
    '/galerija',
    ...CATEGORIES.map((c) => `/galerija/${c.slug}`),
    '/o-meni',
    '/kontakt',
  ],
} satisfies Config
