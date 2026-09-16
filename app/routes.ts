import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  // The site is one page; the menu scrolls to anchors inside it.
  index('routes/home.tsx'),
  // Admin is the one real route, a separate chunk behind Cloudflare Access.
  // It is never imported from public code, so visitors do not download it.
  route('admin/*', 'routes/admin.tsx'),
] satisfies RouteConfig
