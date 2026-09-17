/**
 * Screenshots the built site at a set of viewports and sections.
 *
 *   node scripts/shoot.mjs [--url http://localhost:4173] [--out /tmp/shots]
 *
 * Exists because layout bugs are invisible from the terminal. Two of them —
 * the hero overflowing the fold, and <picture> quietly ignoring height:100%
 * — shipped because the markup and the CSS both looked correct in isolation
 * and only the rendered page disagreed. Uses the Chrome already installed;
 * it downloads nothing.
 */
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const args = process.argv.slice(2)
const argOf = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const URL = argOf('--url', 'http://localhost:4173')
const OUT = argOf('--out', '/tmp/shots')

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'phone', width: 390, height: 844 },
]
const SECTIONS = ['vrh', 'galerija', 'o-meni', 'kontakt']

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
await mkdir(OUT, { recursive: true })

for (const vp of VIEWPORTS) {
  const page = await browser.newPage()
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
  await page.goto(URL, { waitUntil: 'networkidle0' })
  // Smooth scrolling is the navigation on this site, but it makes captures
  // race the animation. Turn it off for the shoot only.
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' })

  for (const id of SECTIONS) {
    await page.evaluate((anchor) => {
      document.getElementById(anchor)?.scrollIntoView({ block: 'start' })
    }, id)
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    await page.screenshot({ path: `${OUT}/${vp.name}-${id}.png` })
  }

  const metrics = await page.evaluate(() => {
    // Back to the top: the rects below are viewport-relative, and the
    // section loop left us at the bottom of the page.
    window.scrollTo(0, 0)
    const el = (s) => document.querySelector(s)
    const hero = el('#vrh > section')
    const mark = el('#vrh > section:last-of-type')
    return {
      viewport: window.innerHeight,
      heroHeight: hero ? Math.round(hero.getBoundingClientRect().height) : null,
      markBottom: mark ? Math.round(mark.getBoundingClientRect().bottom) : null,
      pageHeight: document.documentElement.scrollHeight,
    }
  })
  const fits = metrics.markBottom !== null && metrics.markBottom <= metrics.viewport
  console.log(
    `${vp.name.padEnd(8)} ${vp.width}x${vp.height}  hero ${String(metrics.heroHeight).padStart(4)}px  ` +
      `wordmark ends at ${String(metrics.markBottom).padStart(4)}px  ${fits ? 'FITS' : 'PAST THE FOLD'}`,
  )
  await page.close()
}

// Sideways scrolling is a bug on this site, so sweep for it rather than
// waiting to notice. `scrollWidth` alone misses it: a fixed header does not
// widen the document, which is exactly where the nav was running off the
// edge at 320px. Measure elements against the viewport instead.
const WIDTHS = [280, 320, 360, 390, 430, 640, 768, 1024, 1440]
const page = await browser.newPage()
await page.goto(URL, { waitUntil: 'networkidle0' })
let overflow = 0
for (const width of WIDTHS) {
  await page.setViewport({ width, height: 800 })
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
  const worst = await page.evaluate((vw) => {
    const out = []
    for (const el of document.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0) continue
      if (r.right > vw + 1)
        out.push({
          over: Math.round(r.right - vw),
          tag: el.tagName.toLowerCase(),
          cls: (el.className?.baseVal ?? el.className ?? '').toString().slice(0, 44),
        })
    }
    return out.sort((a, b) => b.over - a.over).slice(0, 2)
  }, width)
  if (worst.length > 0) {
    overflow += 1
    console.log(`${String(width).padStart(5)}px  OVERFLOWS`)
    for (const w of worst) console.log(`         +${w.over}px  ${w.tag} ${w.cls}`)
  }
}
console.log(overflow === 0 ? `\nno horizontal overflow, ${WIDTHS.length} widths` : '')
await page.close()

await browser.close()
console.log(`-> ${OUT}`)
