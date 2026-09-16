import type { Config } from '@react-router/dev/config'

export default {
  // No server runtime: the public site is static files on Cloudflare Pages.
  // Everything dynamic (uploads, auth) lives in the Worker under /api.
  ssr: false,
  // One page, so one prerendered document. It ships with every photo, the
  // about copy and the contact details already in the HTML.
  prerender: ['/'],
} satisfies Config
