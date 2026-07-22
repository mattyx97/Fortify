import type { Browser } from 'rebrowser-puppeteer'
import type { GitHubScrapingData, LinkedInScrapingData, ScrapingData } from '../database/schema/target'
import fs from 'node:fs'
import puppeteer from 'rebrowser-puppeteer'
import {
  GITHUB_CONTRIBUTORS_GRAPH_SCRIPT,
  GITHUB_REPO_DETAIL_SCRIPT,
  GITHUB_SCRIPT,
  LINKEDIN_ACTIVITY_SCRIPT,
  LINKEDIN_PROFILE_SCRIPT,
  SCROLL_SHORT_SCRIPT,
} from './scripts'

const TRAILING_SLASH_RE = /\/$/
const LINKEDIN_DOMAIN_RE = /\/\/([\w-]+\.)?linkedin\.com/
const LINKEDIN_BLOCK_URL_RE = /authwall|\/login|\/uas\/login|\/checkpoint|\/signup|\/authwall/i
const LINKEDIN_BLOCK_NAME_RE = /iscriviti|join linkedin|sign in|sign up|accedi|non sei tu|not you/i

/**
 * True when the LinkedIn page is an auth/security wall (authwall redirect, login page,
 * "Non sei tu?" / "Iscriviti a LinkedIn" interstitial) rather than a real profile.
 * Lets the caller fail the scrape (and retry later) instead of saving junk.
 */
function isBlocked(finalUrl: string, data: LinkedInScrapingData): boolean {
  const nameOrHeadline = `${data.fullName ?? ''} ${data.headline ?? ''}`.trim()
  return LINKEDIN_BLOCK_URL_RE.test(finalUrl)
    || (!!nameOrHeadline && LINKEDIN_BLOCK_NAME_RE.test(nameOrHeadline))
}

export interface IScraperConfig {
  cookiesPath: string
  headless: boolean
}

export type IScraper = ReturnType<typeof setupScraper>

export function setupScraper(config: IScraperConfig) {
  let browser: Browser | null = null
  let launching: Promise<Browser> | null = null

  /** Reads the cookies file fresh each call, so a re-login is picked up without restart. */
  function loadCookies(): Parameters<ReturnType<Browser['defaultBrowserContext']>['setCookie']> {
    if (!fs.existsSync(config.cookiesPath))
      return []
    try {
      return JSON.parse(fs.readFileSync(config.cookiesPath, 'utf-8'))
    }
    catch {
      return []
    }
  }

  /** Applies the current cookies to the browser context (idempotent; overwrites li_at etc.). */
  async function applyCookies(b: Browser) {
    const cookies = loadCookies()
    if (cookies.length)
      await b.defaultBrowserContext().setCookie(...cookies)
  }

  /** Closes and clears the cached browser so the next scrape relaunches with fresh cookies. */
  async function invalidateBrowser() {
    const b = browser
    browser = null
    if (b)
      await b.close().catch(() => {})
  }

  /**
   * Writes the browser's current (LinkedIn-rotated) cookies back to disk after a
   * successful scrape, so the session stays fresh over time like a real browser would.
   * Guarded: only persists an authenticated set (li_at present with a real value), so an
   * authwall/logged-out response can never overwrite the good cookies on disk.
   * Best-effort — a persistence failure must never break a scrape.
   */
  async function persistCookies(b: Browser) {
    try {
      const all = await b.defaultBrowserContext().cookies()
      const linkedin = all.filter(c => (c.domain || '').includes('linkedin.com'))
      const liAt = linkedin.find(c => c.name === 'li_at')
      if (!liAt || !liAt.value || liAt.value.length < 20)
        return
      fs.writeFileSync(config.cookiesPath, JSON.stringify(linkedin, null, 2))
    }
    catch {
      /* best-effort */
    }
  }

  async function getBrowser() {
    if (browser?.connected)
      return browser
    if (launching)
      return launching

    launching = (async () => {
      browser = await puppeteer.launch({
        headless: config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      })
      await applyCookies(browser)
      return browser
    })()

    try {
      return await launching
    }
    finally {
      launching = null
    }
  }

  async function scrapeLinkedIn(profileUrl: string): Promise<LinkedInScrapingData> {
    const b = await getBrowser()
    // Re-apply cookies from disk so a fresh login takes effect on the cached browser.
    await applyCookies(b)
    const page = await b.newPage()
    let blocked = false
    await page.setViewport({ width: 1280, height: 2000 })

    // Block images, fonts, media, analytics to speed up loading
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const type = req.resourceType()
      const url = req.url()
      if (type === 'image' || type === 'font' || type === 'media' || type === 'stylesheet') {
        req.abort()
        return
      }
      if (url.includes('tracking') || url.includes('analytics') || url.includes('ads') || url.includes('beacon')) {
        req.abort()
        return
      }
      req.continue()
    })

    try {
      // Normalize LinkedIn URL to www.linkedin.com (cookies are set on .www.linkedin.com)
      const normalizedUrl = profileUrl.replace(LINKEDIN_DOMAIN_RE, '//www.linkedin.com')

      // Profile page — domcontentloaded is much faster than networkidle2
      await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForSelector('body', { timeout: 10_000 }).catch(() => {})

      // Scroll the whole page so every lazy-loaded section renders before parsing.
      // Stopping as soon as Esperienza/Formazione appear (the old behaviour) left the
      // lower sections — Competenze, Informazioni detail, Interessi — unrendered, so
      // the parser saw empty skills / null bio. Keep scrolling until the tail sections
      // are present too, with a minimum number of passes to let lazy content settle.
      // (document.body can be null briefly on LinkedIn SPA / auth interstitials — use fallbacks)
      await page.evaluate(`(async () => {
        function docText() {
          var b = document.body
          var e = document.documentElement
          var n = b || e
          return n && n.innerText ? n.innerText : ''
        }
        function maxScrollY() {
          var b = document.body
          var e = document.documentElement
          return Math.max(
            b ? b.scrollHeight : 0,
            e ? e.scrollHeight : 0,
            window.innerHeight || 0,
          )
        }
        function tailLoaded() {
          var t = docText()
          var head = (t.indexOf('Esperienza') >= 0 || t.indexOf('Experience') >= 0)
            && (t.indexOf('Formazione') >= 0 || t.indexOf('Education') >= 0)
          var tail = t.indexOf('Competenze') >= 0 || t.indexOf('Skills') >= 0
            || t.indexOf('Interessi') >= 0 || t.indexOf('Interests') >= 0
            || t.indexOf('Licenze') >= 0 || t.indexOf('Licenses') >= 0
          return head && tail
        }
        for (var i = 0; i < 28; i++) {
          var y = maxScrollY()
          if (y <= 0) break
          window.scrollTo(0, y)
          await new Promise(function(r) { setTimeout(r, 300) })
          if (i >= 6 && tailLoaded()) break
        }
        window.scrollTo(0, 0)
        await new Promise(function(r) { setTimeout(r, 900) })
      })()`)

      const profileData = await page.evaluate(LINKEDIN_PROFILE_SCRIPT) as LinkedInScrapingData

      // Detect the auth/security wall ("authwall", login redirect, "Non sei tu?" /
      // "Iscriviti a LinkedIn" interstitial) and fail loudly instead of persisting junk.
      // Otherwise the queue marks the profile 'completed' with garbage that overwrites
      // previously-good data. Throwing makes the queue mark it 'failed' (re-trigger a
      // scrape to retry) and drops the cached browser so the next run uses fresh cookies.
      if (isBlocked(page.url(), profileData)) {
        blocked = true
        throw new Error(
          `LinkedIn auth/security wall while scraping ${profileUrl} `
          + `(final URL: ${page.url()}, name/headline: "${profileData.fullName ?? ''} ${profileData.headline ?? ''}"). `
          + `Likely rate-limited or a stale/expired session — retry later.`,
        )
      }

      // Activity page — posts / reshares (DOM-heavy; scroll to trigger lazy-loaded items).
      // Best-effort: this secondary page is often slow or unavailable, and it must NOT
      // discard the profile data already extracted. On any failure, keep activity empty.
      profileData.activity = []
      try {
        const activityUrl = `${normalizedUrl.replace(TRAILING_SLASH_RE, '')}/recent-activity/all/`
        await page.goto(activityUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 })
        await page.waitForSelector('body', { timeout: 8_000 }).catch(() => {})
        await page.waitForSelector('.feed-shared-update-v2, span[dir="ltr"], .update-components-actor__title', { timeout: 8000 }).catch(() => {})
        for (let s = 0; s < 7; s++) {
          await page.evaluate(SCROLL_SHORT_SCRIPT)
          await new Promise(r => setTimeout(r, 450))
        }
        profileData.activity = await page.evaluate(LINKEDIN_ACTIVITY_SCRIPT) as LinkedInScrapingData['activity']
      }
      catch {
        // Activity is optional; return the profile with whatever else we captured.
      }

      // Scrape succeeded (not blocked): save the rotated session cookies back to disk
      // so the session stays fresh for the next run, mirroring a real browser.
      await persistCookies(b)

      return profileData
    }
    finally {
      await page.close().catch(() => {})
      // A blocked session won't recover on the cached browser; drop it so the next
      // attempt relaunches and reloads cookies (e.g. after the user re-logs in).
      if (blocked)
        await invalidateBrowser()
    }
  }

  async function scrapeGitHub(profileUrl: string): Promise<GitHubScrapingData> {
    const b = await getBrowser()
    await applyCookies(b)
    const page = await b.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    const maxRepoEnrich = 6

    try {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 })
      await page.waitForSelector('.p-nickname', { timeout: 5000 }).catch(() => {})
      await page.evaluate(SCROLL_SHORT_SCRIPT).catch(() => {})

      const data = await page.evaluate(GITHUB_SCRIPT) as GitHubScrapingData
      const repos = (data.repositories ?? []).filter(r => Boolean(r.url?.includes('github.com')))

      for (let i = 0; i < Math.min(repos.length, maxRepoEnrich); i++) {
        const repo = repos[i]!
        try {
          await page.goto(repo.url, { waitUntil: 'domcontentloaded', timeout: 12_000 })
          await page.waitForSelector('body', { timeout: 5000 }).catch(() => {})

          const detail = await page.evaluate(GITHUB_REPO_DETAIL_SCRIPT) as {
            readmePreview: string | null
            contributors: { login: string, profileUrl: string }[]
          }
          repo.readmePreview = detail.readmePreview
          if (detail.contributors?.length)
            repo.contributors = detail.contributors

          if (!detail.contributors?.length) {
            const contribUrl = `${repo.url.replace(TRAILING_SLASH_RE, '')}/graphs/contributors`
            await page.goto(contribUrl, { waitUntil: 'domcontentloaded', timeout: 12_000 }).catch(() => {})
            const graph = await page.evaluate(GITHUB_CONTRIBUTORS_GRAPH_SCRIPT).catch(() => ({
              contributors: [] as { login: string, profileUrl: string }[],
            })) as { contributors: { login: string, profileUrl: string }[] }
            if (graph.contributors?.length)
              repo.contributors = graph.contributors
          }
        }
        catch {
          /* repo privato, 404, rate limit */
        }
      }

      return data
    }
    finally {
      await page.close()
    }
  }

  async function scrape(platform: 'linkedin', profileUrl: string): Promise<LinkedInScrapingData>
  async function scrape(platform: 'github', profileUrl: string): Promise<GitHubScrapingData>
  async function scrape(platform: 'linkedin' | 'github', profileUrl: string): Promise<ScrapingData> {
    switch (platform) {
      case 'linkedin':
        return scrapeLinkedIn(profileUrl)
      case 'github':
        return scrapeGitHub(profileUrl)
    }
  }

  async function close() {
    if (browser) {
      await browser.close()
      browser = null
    }
  }

  return { scrape, scrapeLinkedIn, scrapeGitHub, close }
}
