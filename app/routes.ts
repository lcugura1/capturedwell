import { type RouteConfig, index } from '@react-router/dev/routes'

export default [
  // The whole site is one page; the menu scrolls to anchors inside it.
  //
  // There is no second route. There used to be `/admin`, for a dashboard
  // behind Cloudflare Access — that plan was replaced by the Drive sync,
  // which needs no page of its own because Damir does the work in a folder.
  // See docs/plan-drive-sync.md.
  index('routes/home.tsx'),
] satisfies RouteConfig
