import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import puppeteer from 'rebrowser-puppeteer'

const COOKIES_PATH = path.resolve(import.meta.dirname, '../.cookies.json')

/** Prefer env, then a normal Chrome install; Puppeteer’s downloaded Chrome is used if neither applies. */
function resolveChromeExecutable(): string | undefined {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
  if (fromEnv && fs.existsSync(fromEnv))
    return fromEnv

  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA
    const candidates = [
      local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean) as string[]
    for (const p of candidates) {
      if (fs.existsSync(p))
        return p
    }
  }
  else if (process.platform === 'darwin') {
    const p = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    if (fs.existsSync(p))
      return p
  }
  else {
    for (const p of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
      if (fs.existsSync(p))
        return p
    }
  }
  return undefined
}

async function main() {
  const systemChrome = resolveChromeExecutable()
  const launchOpts: Parameters<typeof puppeteer.launch>[0] = {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    ...(systemChrome ? { executablePath: systemChrome } : {}),
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>>
  try {
    browser = await puppeteer.launch(launchOpts)
  }
  catch (err) {
    console.error(String(err))
    console.error(
      '\nInstall the browser build Puppeteer expects:\n  pnpm run puppeteer:install-chrome\n'
      + 'Or set PUPPETEER_EXECUTABLE_PATH to your Chrome/Chromium binary.\n',
    )
    process.exit(1)
  }

  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' })

  console.log('\nLog in to LinkedIn in the browser.')
  console.log('When you reach the feed, close the browser window.\n')

  let saved = false
  async function saveCookies() {
    if (saved)
      return
    saved = true
    const cookies = await browser.defaultBrowserContext().cookies()
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2))
    console.log(`\nSaved ${cookies.length} cookies to ${COOKIES_PATH}`)
  }

  // Poll for feed URL — means login succeeded
  const interval = setInterval(async () => {
    try {
      const url = page.url()
      if (url.includes('/feed') || url.includes('/mynetwork') || url.includes('/in/')) {
        clearInterval(interval)
        await saveCookies()
        console.log('Login detected! You can close the browser now.')
      }
    }
    catch {}
  }, 2000)

  browser.on('disconnected', async () => {
    clearInterval(interval)
    console.log('Browser closed.')
    process.exit(0)
  })
}

main()
