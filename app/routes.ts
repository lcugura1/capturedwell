import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('galerija', 'routes/gallery.tsx'),
  route('galerija/:slug', 'routes/category.tsx'),
  route('o-meni', 'routes/about.tsx'),
  route('kontakt', 'routes/contact.tsx'),
  // Admin is a separate chunk behind Cloudflare Access. It is never
  // imported from public code, so visitors do not download it.
  route('admin/*', 'routes/admin.tsx'),
] satisfies RouteConfig
