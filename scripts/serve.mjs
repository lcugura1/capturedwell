/**
 * Serves the production build on the local network.
 *
 *   npm run build && npm run preview:phone
 *
 * `npm run dev:phone` is the other half of this: it exposes the dev server
 * for live editing. Use that while working, and this when judging how the
 * site actually performs — the dev bundle is unminified, unsplit and served
 * without compression, so it says nothing useful about load time.
 */
import { createServer } from 'node:http'
import { createReadStream, statSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize } from 'node:path'

const ROOT = 'build/client'
const PORT = Number(process.env.PORT ?? 4173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

createServer((req, res) => {
  // Strip the query and normalise away any `..`, so a request cannot climb
  // out of the build directory.
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(
    /^(\.\.[/\\])+/,
    '',
  )
  let file = join(ROOT, path)
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
  } catch {
    // The site is one prerendered page; anything unknown is that page.
    file = join(ROOT, 'index.html')
  }
  try {
    statSync(file)
  } catch {
    file = join(ROOT, 'index.html')
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(res)
}).listen(PORT, '0.0.0.0', () => {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address)
  console.log(`\n  local:   http://localhost:${PORT}`)
  for (const address of addresses) console.log(`  network: http://${address}:${PORT}`)
  console.log('\n  Same Wi-Fi, then open the network address on the phone.\n')
})
