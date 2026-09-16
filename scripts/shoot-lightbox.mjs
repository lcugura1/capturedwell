/**
 * Captures the genie mid-flight by pausing its animations at fixed points.
 *
 * Screenshotting on a timer races the compositor and mostly catches the
 * settled state; seeking the WAAPI timeline gives the same frame every run.
 */
import puppeteer from 'puppeteer-core'

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = process.argv[2] ?? '/tmp/shots'
const CATEGORY = process.argv[3] ?? 'događaji'
const STOPS = [0.08, 0.2, 0.35, 0.55, 1]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' })
await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' })
await page.evaluate(() => document.getElementById('galerija')?.scrollIntoView())

await page.evaluate((name) => {
  const pill = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === name,
  )
  pill?.click()
}, CATEGORY)
await page.waitForSelector('[data-photo-id]')

// Every category is in the DOM; the inactive ones are `hidden` and measure
// zero, so pick from the visible grid only.
const visible = () =>
  [...document.querySelectorAll('[data-photo-id]')].filter((el) => el.offsetParent !== null)

const thumb = await page.evaluate((fn) => {
  const r = eval(`(${fn})`)()[1].getBoundingClientRect()
  return { w: Math.round(r.width), h: Math.round(r.height) }
}, visible.toString())
await page.evaluate((fn) => eval(`(${fn})`)()[1].click(), visible.toString())
await page.waitForSelector('[role="dialog"]')

for (const stop of STOPS) {
  await page.evaluate((p) => {
    // Seek the backdrop too, or the first frames are captured against a
    // half-faded page and every comparison shifts.
    for (const a of document.querySelector('[role="dialog"]').getAnimations({ subtree: true })) {
      a.pause()
      a.currentTime = (a.effect.getComputedTiming().duration ?? 0) * p
    }
  }, stop)
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )
  await page.screenshot({ path: `${OUT}/genie-${String(stop).replace('.', '')}.png` })
}

console.log(`thumbnail ${thumb.w}x${thumb.h}  ->  ${STOPS.length} frames in ${OUT}`)
await browser.close()
