import type { IScraper } from '../lib/scraper'
import { setupScraper } from '../lib/scraper'

let _cache: IScraper
export function useScraper() {
  return _cache ??= setupScraper({
    cookiesPath: '.cookies.json',
    headless: true,
  })
}
