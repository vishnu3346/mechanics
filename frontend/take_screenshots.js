import puppeteer from 'puppeteer-core'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '..', 'screenshots')

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true })
}

const PAGES = [
  { name: 'overview', url: 'http://127.0.0.1:5173/overview' },
  { name: 'vision', url: 'http://127.0.0.1:5173/vision' },
  { name: 'simulation', url: 'http://127.0.0.1:5173/simulation' },
  { name: 'anomaly', url: 'http://127.0.0.1:5173/anomaly' },
  { name: 'energy', url: 'http://127.0.0.1:5173/energy' },
  { name: 'scenarios', url: 'http://127.0.0.1:5173/scenarios' },
  { name: 'history', url: 'http://127.0.0.1:5173/history' },
  { name: 'settings', url: 'http://127.0.0.1:5173/settings' },
]

async function run() {
  console.log('Launching Chrome for multi-mode visual verification...')
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900 },
  })

  // 1. Capture Dark Mode
  console.log('--- Capturing Dark Mode ---')
  const darkPage = await browser.newPage()
  await darkPage.evaluateOnNewDocument(() => {
    localStorage.setItem('medwaste-theme', 'dark')
  })
  for (const p of PAGES) {
    await darkPage.goto(p.url, { waitUntil: 'networkidle0', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 1000))
    const darkPath = path.join(outDir, `dark_${p.name}.png`)
    await darkPage.screenshot({ path: darkPath })
    console.log(`Saved: ${darkPath}`)
  }
  await darkPage.close()

  // 2. Capture Light Mode
  console.log('--- Capturing Light Mode ---')
  const lightPage = await browser.newPage()
  await lightPage.evaluateOnNewDocument(() => {
    localStorage.setItem('medwaste-theme', 'light')
  })
  for (const p of PAGES) {
    await lightPage.goto(p.url, { waitUntil: 'networkidle0', timeout: 15000 })
    await new Promise((r) => setTimeout(r, 1000))
    const lightPath = path.join(outDir, `light_${p.name}.png`)
    await lightPage.screenshot({ path: lightPath })
    console.log(`Saved: ${lightPath}`)
  }
  await lightPage.close()

  await browser.close()
  console.log('Finished capturing all multi-mode screenshots!')
}

run().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
