import { schema } from '#server/lib/database/schema'
import { extractSiteProfile } from '#server/services/site-profile-extract'
import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm'
import {
  markWebsiteScrapeFailed,
  markWebsiteScrapeInProgress,
  saveScrapingResult,
  saveWebsiteProfile,
} from './targets'

/**
 * Finds social profiles that need scraping: status 'pending' or last scraped over 30 days ago.
 */
export async function findProfilesToScrape() {
  const db = useDatabase()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  return db.query.employeeSocialProfile.findMany({
    where: {
      OR: [
        { scrapingStatus: 'pending' },
        { lastScrapedAt: { lt: thirtyDaysAgo } },
      ],
    },
  })
}

/**
 * Marks a social profile as in_progress before scraping begins.
 */
export async function markScrapingInProgress(profileId: string) {
  const db = useDatabase()

  await db
    .update(schema.employeeSocialProfile)
    .set({ scrapingStatus: 'in_progress' })
    .where(eq(schema.employeeSocialProfile.id, profileId))
}

/**
 * Marks a social profile as failed after a scraping error.
 */
export async function markScrapingFailed(profileId: string) {
  const db = useDatabase()

  await db
    .update(schema.employeeSocialProfile)
    .set({ scrapingStatus: 'failed' })
    .where(eq(schema.employeeSocialProfile.id, profileId))
}

/**
 * Resets all social profiles of a target to 'pending' so the scraping task picks them up.
 */
export async function resetProfilesToPending(targetId: string) {
  const db = useDatabase()

  await db
    .update(schema.employeeSocialProfile)
    .set({ scrapingStatus: 'pending' })
    .where(eq(schema.employeeSocialProfile.targetId, targetId))
}

/**
 * Marks website extraction as pending when the target has a website URL (used when user triggers scrape).
 */
export async function resetWebsiteScrapeToPending(targetId: string) {
  const db = useDatabase()

  await db
    .update(schema.employeeTarget)
    .set({ websiteScrapingStatus: 'pending' })
    .where(and(
      eq(schema.employeeTarget.id, targetId),
      isNotNull(schema.employeeTarget.websiteUrl),
    ))
}

/**
 * Finds targets with a website URL that need HTML/DNS/WHOIS extraction: pending, never completed, or stale (>30 days).
 */
export async function findTargetsWithWebsiteToScrape() {
  const db = useDatabase()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  return db
    .select()
    .from(schema.employeeTarget)
    .where(
      and(
        isNotNull(schema.employeeTarget.websiteUrl),
        or(
          eq(schema.employeeTarget.websiteScrapingStatus, 'pending'),
          isNull(schema.employeeTarget.websiteScrapingStatus),
          and(
            eq(schema.employeeTarget.websiteScrapingStatus, 'completed'),
            or(
              isNull(schema.employeeTarget.websiteLastScrapedAt),
              lt(schema.employeeTarget.websiteLastScrapedAt, thirtyDaysAgo),
            ),
          ),
        ),
      ),
    )
}

/**
 * Processes all profiles that need scraping: fetches pending/stale profiles,
 * scrapes each one, and saves the results.
 * @returns number of social profiles processed.
 */
export async function processSocialScrapingQueue(): Promise<number> {
  const logger = useLogger()
  const scraper = useScraper()
  const profiles = await findProfilesToScrape()

  if (profiles.length === 0)
    return 0

  logger.info(`[scraping] Found ${profiles.length} profile(s) to scrape`)
  let processed = 0

  for (const profile of profiles) {
    if (profile.platform !== 'linkedin' && profile.platform !== 'github') {
      logger.debug(`[scraping] Skipping unsupported platform: ${profile.platform}`)
      continue
    }

    try {
      await markScrapingInProgress(profile.id)
      logger.info(`[scraping] Scraping ${profile.platform}: ${profile.profileUrl}`)

      const data = profile.platform === 'linkedin'
        ? await scraper.scrapeLinkedIn(profile.profileUrl)
        : await scraper.scrapeGitHub(profile.profileUrl)
      await saveScrapingResult({ socialProfileId: profile.id, data })

      logger.info(`[scraping] Done: ${profile.profileUrl}`)
      processed++
    }
    catch (err) {
      logger.error(`[scraping] Failed: ${profile.profileUrl}`, err)
      await markScrapingFailed(profile.id)
    }
  }

  return processed
}

/**
 * Runs server-side site profile extraction (fetch HTML, cheerio, DNS/WHOIS) for queued targets.
 * @returns number of targets processed.
 */
export async function processWebsiteScrapingQueue(): Promise<number> {
  const logger = useLogger()
  const targets = await findTargetsWithWebsiteToScrape()

  if (targets.length === 0)
    return 0

  logger.info(`[scraping] Found ${targets.length} website(s) to scrape`)
  let processed = 0

  for (const target of targets) {
    const url = target.websiteUrl
    if (!url)
      continue

    try {
      await markWebsiteScrapeInProgress(target.id)
      logger.info(`[scraping] Website: ${url}`)
      const data = await extractSiteProfile({ url })
      await saveWebsiteProfile({ targetId: target.id, data })
      logger.info(`[scraping] Website done: ${url}`)
      processed++
    }
    catch (err) {
      logger.error(`[scraping] Website failed: ${url}`, err)
      await markWebsiteScrapeFailed(target.id)
    }
  }

  return processed
}

/**
 * Processes social profile queue and website extraction queue.
 */
export async function processScrapingQueue(): Promise<{ profiles: number, websites: number }> {
  const profiles = await processSocialScrapingQueue()
  const websites = await processWebsiteScrapingQueue()
  return { profiles, websites }
}
