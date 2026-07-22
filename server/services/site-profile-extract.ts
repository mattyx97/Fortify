import dns from 'node:dns/promises'
import net from 'node:net'
import { createAppError } from '#server/utils/errors'
import * as cheerio from 'cheerio'
import { whoisDomain } from 'whoiser'

const MAX_HTML_BYTES = 2 * 1024 * 1024
const CONTENT_PREVIEW_MAX_CHARS = 6000
const FETCH_TIMEOUT_MS = 20_000
const MAX_REDIRECTS = 5
const USER_AGENT = 'FortifySiteProfile/1.0 (+https://github.com)'

const SECTION_SELECTORS = [
  '[id*="about" i]',
  '[class*="about" i]',
  '[id*="project" i]',
  '[class*="project" i]',
  '[id*="contact" i]',
  '[class*="contact" i]',
]

const RE_WHITESPACE_SQUEEZE = /\s+/g
const RE_IPV4_EMBEDDED_PREFIX = /^:+/
const RE_GITHUB_PROFILE = /github\.com\/[\w.-]+/i
const RE_LINKEDIN_PATH = /linkedin\.com\/(?:in|company)\//i
const RE_PDF_OR_HASH = /\.pdf(?:\?|$|#)/i
const RE_CV_RESUME = /\/cv\b|\/resume\b|curriculum/i
const RE_BLOG_HINTS = /medium\.com|substack\.com|dev\.to|hashnode|ghost\.io\/|\.blog\b|\/blog\//i
const RE_PORTFOLIO_HINTS = /dribbble\.com|behance\.net|portfolio/i
const RE_MAILTO_PREFIX = /^mailto:/i
const RE_WWW_PREFIX = /^www\./i
const RE_FIRST_TOKEN = /\s+/

const TECH_PATTERNS: { name: string, re: RegExp }[] = [
  { name: 'google-analytics', re: /google-analytics\.com|googletagmanager\.com|gtag\(/i },
  { name: 'plausible', re: /plausible\.io/i },
  { name: 'umami', re: /umami\.is|analytics\.umami/i },
  { name: 'cloudflare', re: /cloudflare|cf-ray/i },
  { name: 'vercel', re: /vercel|_next\/static/i },
  { name: 'netlify', re: /netlify/i },
  { name: 'nuxt', re: /nuxt|__nuxt/i },
  { name: 'next', re: /__next|_next\//i },
  { name: 'react', re: /react@|react\.production|__REACT/i },
  { name: 'vue', re: /vue@|vue\.runtime|__VUE/i },
  { name: 'wordpress', re: /wp-content|wp-includes|wordpress/i },
  { name: 'bootstrap', re: /bootstrap(\.min)?\.(css|js)/i },
  { name: 'tailwind', re: /tailwind/i },
  { name: 'cdnjs', re: /cdnjs\.cloudflare\.com/i },
  { name: 'jsdelivr', re: /jsdelivr\.net/i },
  { name: 'unpkg', re: /unpkg\.com/i },
  { name: 'stripe', re: /js\.stripe\.com/i },
]

export interface SiteProfileExtractResult {
  requestedUrl: string
  finalUrl: string
  page: {
    title: string | null
    metaDescription: string | null
    /** Open Graph / social title when present */
    ogTitle: string | null
    /** meta keywords when present */
    keywords: string | null
    /** Resolved absolute canonical URL */
    canonical: string | null
    /** Visible text from main/article/body (scripts/styles stripped), truncated */
    contentPreview: string | null
    headings: { level: number, text: string }[]
    sections: {
      about: string | null
      projects: string | null
      contacts: string | null
    }
  }
  links: {
    github: string[]
    linkedin: string[]
    emails: string[]
    cv: string[]
    blog: string[]
    portfolio: string[]
    otherNotable: string[]
  }
  technologies: {
    metaGenerator: string | null
    scriptHosts: string[]
    stylesheetHosts: string[]
    externalScripts: string[]
    detected: string[]
  }
  infrastructure: {
    hostname: string
    dns: {
      a: string[]
      aaaa: string[]
      ns: string[]
      txt: string[]
    }
    responseHeaders: Record<string, string>
    whois: Record<string, unknown> | null
    whoisError: string | null
  }
}

function isPrivateOrLocalIPv4(parts: number[]): boolean {
  const a = parts[0]
  const b = parts[1]
  if (a === undefined || b === undefined)
    return true
  if (a === 10)
    return true
  if (a === 127)
    return true
  if (a === 0)
    return true
  if (a === 169 && b === 254)
    return true
  if (a === 192 && b === 168)
    return true
  if (a === 172 && b >= 16 && b <= 31)
    return true
  if (a === 100 && b >= 64 && b <= 127)
    return true
  return false
}

function isPublicIp(ip: string): boolean {
  const fam = net.isIP(ip)
  if (fam === 4) {
    const parts = ip.split('.').map(Number)
    return !isPrivateOrLocalIPv4(parts)
  }
  if (fam === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1')
      return false
    if (lower.startsWith('fe80:'))
      return false
    if (lower.startsWith('fc') || lower.startsWith('fd'))
      return false
    if (lower.startsWith('::ffff:')) {
      const v4 = lower.slice(7).replace(RE_IPV4_EMBEDDED_PREFIX, '')
      const parts = v4.split('.').map(Number)
      if (parts.length === 4 && parts.every(n => !Number.isNaN(n)))
        return !isPrivateOrLocalIPv4(parts)
    }
    return true
  }
  return false
}

async function assertUrlSafeForFetch(url: URL): Promise<void> {
  if (url.username || url.password) {
    throw createAppError(400, {
      code: 'URL_NOT_ALLOWED',
      message: 'URL must not contain credentials',
    })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw createAppError(400, {
      code: 'URL_NOT_ALLOWED',
      message: 'Only http and https URLs are allowed',
    })
  }
  const host = url.hostname
  if (!host) {
    throw createAppError(400, {
      code: 'URL_NOT_ALLOWED',
      message: 'Invalid URL host',
    })
  }

  const ipVer = net.isIP(host)
  if (ipVer) {
    if (!isPublicIp(host)) {
      throw createAppError(400, {
        code: 'URL_NOT_ALLOWED',
        message: 'Target address is not allowed',
      })
    }
    return
  }

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw createAppError(400, {
      code: 'URL_NOT_ALLOWED',
      message: 'Target host is not allowed',
    })
  }

  let addresses: string[] = []
  try {
    const v4 = await dns.resolve4(host).catch(() => [] as string[])
    const v6 = await dns.resolve6(host).catch(() => [] as string[])
    addresses = [...v4, ...v6]
  }
  catch {
    addresses = []
  }
  if (addresses.length === 0) {
    try {
      const r = await dns.lookup(host, { all: true })
      addresses = r.map(x => x.address)
    }
    catch {
      throw createAppError(400, {
        code: 'DNS_FAILED',
        message: 'Could not resolve hostname',
      })
    }
  }
  for (const ip of addresses) {
    if (!isPublicIp(ip)) {
      throw createAppError(400, {
        code: 'URL_NOT_ALLOWED',
        message: 'Hostname resolves to a non-public address',
      })
    }
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((v, k) => {
    out[k.toLowerCase()] = v
  })
  return out
}

async function fetchHtmlWithRedirects(startUrl: URL): Promise<{
  html: string
  finalUrl: string
  responseHeaders: Record<string, string>
}> {
  let url = new URL(startUrl.href)
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertUrlSafeForFetch(url)

    const res = await fetch(url.href, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en,en-US;q=0.9',
      },
      signal,
    })

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc || hop === MAX_REDIRECTS) {
        throw createAppError(502, {
          code: 'FETCH_FAILED',
          message: 'Too many redirects or missing Location header',
        })
      }
      url = new URL(loc, url)
      continue
    }

    if (!res.ok) {
      throw createAppError(502, {
        code: 'FETCH_FAILED',
        message: `HTTP ${res.status} fetching page`,
      })
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > MAX_HTML_BYTES) {
      throw createAppError(413, {
        code: 'PAGE_TOO_LARGE',
        message: `HTML exceeds ${MAX_HTML_BYTES} bytes`,
      })
    }

    const html = buf.toString('utf-8')
    return {
      html,
      finalUrl: url.href,
      responseHeaders: headersToRecord(res.headers),
    }
  }

  throw createAppError(502, {
    code: 'FETCH_FAILED',
    message: 'Redirect loop',
  })
}

function trimSectionText(text: string, max = 2000): string {
  const t = text.replace(RE_WHITESPACE_SQUEEZE, ' ').trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function classifyHref(href: string): keyof SiteProfileExtractResult['links'] | 'skip' | 'other' {
  const lower = href.toLowerCase()
  if (lower.startsWith('mailto:')) {
    return 'emails'
  }
  if (RE_GITHUB_PROFILE.test(href)) {
    return 'github'
  }
  if (RE_LINKEDIN_PATH.test(href)) {
    return 'linkedin'
  }
  if (RE_PDF_OR_HASH.test(href) || RE_CV_RESUME.test(href)) {
    return 'cv'
  }
  if (RE_BLOG_HINTS.test(href)) {
    return 'blog'
  }
  if (RE_PORTFOLIO_HINTS.test(href)) {
    return 'portfolio'
  }
  if (lower.startsWith('javascript:') || lower === '#' || lower.startsWith('tel:')) {
    return 'skip'
  }
  return 'other'
}

function uniquePush(arr: string[], v: string) {
  if (v && !arr.includes(v))
    arr.push(v)
}

function detectFromSources(sources: string[]): string[] {
  const found = new Set<string>()
  const blob = sources.join('\n')
  for (const { name, re } of TECH_PATTERNS) {
    if (re.test(blob))
      found.add(name)
  }
  return [...found].sort()
}

function toJsonSafe(value: unknown, depth = 0): unknown {
  if (depth > 10)
    return undefined
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value
  if (Array.isArray(value)) {
    return value
      .map(v => toJsonSafe(v, depth + 1))
      .filter(v => v !== undefined)
  }
  if (typeof value === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith('__'))
        continue
      const t = toJsonSafe(v, depth + 1)
      if (t !== undefined)
        o[k] = t
    }
    return o
  }
  return undefined
}

/**
 * Fetches a public URL, parses HTML for content and links, resolves DNS, captures response headers, and runs WHOIS on the registrable host.
 * @throws FETCH_FAILED if the HTTP request fails.
 * @throws URL_NOT_ALLOWED if the URL fails SSRF checks.
 */
export async function extractSiteProfile(params: { url: string }): Promise<SiteProfileExtractResult> {
  let parsed: URL
  try {
    parsed = new URL(params.url)
  }
  catch {
    throw createAppError(400, {
      code: 'VALIDATION_FAILED',
      message: 'Invalid URL',
    })
  }

  const { html, finalUrl, responseHeaders } = await fetchHtmlWithRedirects(parsed)
  const base = new URL(finalUrl)
  const hostname = base.hostname

  const $ = cheerio.load(html)

  const title = $('title').first().text().trim() || null
  const metaDescription
    = $('meta[name="description"]').attr('content')?.trim()
      || $('meta[property="og:description"]').attr('content')?.trim()
      || null
  const metaGenerator = $('meta[name="generator"]').attr('content')?.trim() || null
  const ogTitle = $('meta[property="og:title"]').attr('content')?.trim() || null
  const keywords = $('meta[name="keywords"]').attr('content')?.trim() || null
  let canonical: string | null = null
  const canHref = $('link[rel="canonical"]').attr('href')?.trim()
  if (canHref) {
    try {
      canonical = new URL(canHref, base).href
    }
    catch {
      canonical = canHref
    }
  }

  const $plain = cheerio.load(html)
  $plain('script, style, noscript, svg, iframe').remove()
  const mainEl = $plain('main')
  const articleEl = $plain('article')
  const bodyEl = $plain('body')
  const textRoot = mainEl.length > 0 ? mainEl : articleEl.length > 0 ? articleEl : bodyEl
  const contentPreview = textRoot.length > 0
    ? trimSectionText(textRoot.text(), CONTENT_PREVIEW_MAX_CHARS)
    : null

  const headings: { level: number, text: string }[] = []
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el.tagName || 'h1').toLowerCase()
    const level = Number.parseInt(tag.slice(1), 10)
    const safeLevel = Number.isFinite(level) && level >= 1 && level <= 6 ? level : 1
    const text = $(el).text().trim()
    if (text)
      headings.push({ level: safeLevel, text })
  })

  const sections = { about: null as string | null, projects: null as string | null, contacts: null as string | null }
  for (const sel of SECTION_SELECTORS) {
    const el = $(sel).first()
    if (!el.length)
      continue
    const idClass = `${el.attr('id') || ''} ${el.attr('class') || ''}`.toLowerCase()
    const text = trimSectionText(el.text())
    if (!text)
      continue
    if (idClass.includes('about') && !sections.about)
      sections.about = text
    if (idClass.includes('project') && !sections.projects)
      sections.projects = text
    if (idClass.includes('contact') && !sections.contacts)
      sections.contacts = text
  }

  const links: SiteProfileExtractResult['links'] = {
    github: [],
    linkedin: [],
    emails: [],
    cv: [],
    blog: [],
    portfolio: [],
    otherNotable: [],
  }

  const externalScripts: string[] = []
  const scriptHosts = new Set<string>()
  const stylesheetHosts = new Set<string>()

  $('a[href]').each((_, el) => {
    const raw = $(el).attr('href')?.trim()
    if (!raw)
      return
    let absolute: string
    try {
      absolute = new URL(raw, base).href
    }
    catch {
      return
    }
    const kind = classifyHref(absolute)
    if (kind === 'skip')
      return
    if (kind === 'emails') {
      const addr = absolute.replace(RE_MAILTO_PREFIX, '').split('?')[0]?.trim()
      if (addr)
        uniquePush(links.emails, addr)
      return
    }
    if (kind === 'github')
      uniquePush(links.github, absolute)
    else if (kind === 'linkedin')
      uniquePush(links.linkedin, absolute)
    else if (kind === 'cv')
      uniquePush(links.cv, absolute)
    else if (kind === 'blog')
      uniquePush(links.blog, absolute)
    else if (kind === 'portfolio')
      uniquePush(links.portfolio, absolute)
    else if (absolute.startsWith('http') && new URL(absolute).hostname !== base.hostname)
      uniquePush(links.otherNotable, absolute)
  })

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src')?.trim()
    if (!src)
      return
    try {
      const u = new URL(src, base)
      externalScripts.push(u.href)
      scriptHosts.add(u.hostname)
    }
    catch { /* ignore */ }
  })

  $('link[rel="stylesheet"][href]').each((_, el) => {
    const href = $(el).attr('href')?.trim()
    if (!href)
      return
    try {
      stylesheetHosts.add(new URL(href, base).hostname)
    }
    catch { /* ignore */ }
  })

  const headerBlob = Object.entries(responseHeaders).map(([k, v]) => `${k}:${v}`).join('\n')
  const techSources = [
    ...externalScripts,
    ...Array.from(stylesheetHosts, h => `//${h}/`),
    metaGenerator || '',
    html.slice(0, 80_000),
    headerBlob,
  ]
  const detected = detectFromSources(techSources)
  if (metaGenerator)
    detected.push(`generator:${metaGenerator.split(RE_FIRST_TOKEN)[0]}`)
  const detectedUnique = [...new Set(detected)].sort()

  const dnsResult: SiteProfileExtractResult['infrastructure']['dns'] = {
    a: [],
    aaaa: [],
    ns: [],
    txt: [],
  }
  try {
    dnsResult.a = await dns.resolve4(hostname)
  }
  catch { /* empty */ }
  try {
    dnsResult.aaaa = await dns.resolve6(hostname)
  }
  catch { /* empty */ }
  try {
    dnsResult.ns = await dns.resolveNs(hostname)
  }
  catch { /* empty */ }
  try {
    const txt = await dns.resolveTxt(hostname)
    dnsResult.txt = txt.flat().slice(0, 20)
  }
  catch { /* empty */ }

  const whoisHost = hostname.replace(RE_WWW_PREFIX, '')
  let whois: Record<string, unknown> | null = null
  let whoisError: string | null = null
  try {
    const raw = await whoisDomain(whoisHost, { timeout: 12_000, follow: 1 })
    whois = toJsonSafe(raw) as Record<string, unknown> | null
  }
  catch (e) {
    whoisError = e instanceof Error ? e.message : String(e)
  }

  return {
    requestedUrl: params.url,
    finalUrl,
    page: {
      title,
      metaDescription,
      ogTitle,
      keywords,
      canonical,
      contentPreview,
      headings,
      sections,
    },
    links,
    technologies: {
      metaGenerator,
      scriptHosts: [...scriptHosts].sort(),
      stylesheetHosts: [...stylesheetHosts].sort(),
      externalScripts: externalScripts.slice(0, 200),
      detected: detectedUnique,
    },
    infrastructure: {
      hostname,
      dns: dnsResult,
      responseHeaders,
      whois,
      whoisError,
    },
  }
}
