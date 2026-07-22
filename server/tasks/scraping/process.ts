import { processScrapingQueue } from '#server/services/scraping'

export default defineTask({
  meta: {
    name: 'scraping:process',
    description: 'Scrapes all pending social profiles and profiles not scraped in over 30 days',
  },
  async run() {
    const { profiles, websites } = await processScrapingQueue()
    return { result: { profiles, websites } }
  },
})
