/** Opens the lightbox and captures it mid-animation and settled. */
import puppeteer from 'puppeteer-core'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = process.argv[2] ?? '/tmp/shots'
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' })
await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' })
await page.evaluate(() => document.getElementById('galerija')?.scrollIntoView())
await page.waitForSelector('[data-photo-id]')
await page.click('[data-photo-id]')
await new Promise((r) => setTimeout(r, 180))
await page.screenshot({ path: `${OUT}/lightbox-mid.png` })
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${OUT}/lightbox-open.png` })
const state = await page.evaluate(() => ({
  dialog: !!document.querySelector('[role="dialog"]'),
  focused: document.activeElement?.getAttribute('aria-label') ?? null,
}))
console.log(state)
await browser.close()
