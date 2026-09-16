/**
 * Renders an SVG to square PNGs at the given sizes.
 *
 *   node scripts/rasterize.mjs <in.svg> <out-prefix> 16 32 180
 *
 * Uses the installed Chrome as the rasteriser. macOS ships no CLI SVG
 * renderer, and Chrome is the engine that will actually draw this icon in
 * the wild — so what it produces is what people will see.
 */
import { readFile, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const CHROME =
  process.env.CHROME_PATH ??
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const [svgPath, outBase, ...sizes] = process.argv.slice(2)
if (!svgPath || !outBase || sizes.length === 0) {
  console.error('usage: rasterize.mjs <in.svg> <out-prefix> <size> [size...]')
  process.exit(1)
}

const svg = await readFile(svgPath, 'utf8')
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true })

for (const size of sizes) {
  const n = Number(size)
  const page = await browser.newPage()
  await page.setViewport({ width: n, height: n, deviceScaleFactor: 1 })
  await page.setContent(
    `<style>html,body{margin:0;padding:0}svg{display:block;width:${n}px;height:${n}px}</style>${svg}`,
    { waitUntil: 'load' },
  )
  await writeFile(`${outBase}-${n}.png`, await page.screenshot({ omitBackground: true }))
  await page.close()
  console.log(`${outBase}-${n}.png`)
}

await browser.close()
