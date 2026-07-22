import type { ScrapingData } from '#server/lib/database/schema/target'
import type { SiteProfileExtractResult } from '#server/services/site-profile-extract'
import { schema } from '#server/lib/database/schema'
import { and, eq } from 'drizzle-orm'

/**
 * Creates an employee target with optional social profiles.
 * Social profiles are created with scraping status 'pending'.
 */
export async function createTarget(params: {
  organizationId: string
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
  jobTitle?: string
  department?: string
  websiteUrl?: string | null
  profiles?: { platform: 'linkedin' | 'github' | 'twitter' | 'facebook' | 'instagram', profileUrl: string }[]
}) {
  const db = useDatabase()
  const websiteUrl = params.websiteUrl?.trim() || null

  return db.transaction(async (tx) => {
    const target = await tx.insert(schema.employeeTarget).values({
      organizationId: params.organizationId,
      firstName: params.firstName,
      lastName: params.lastName,
      email: params.email,
      phoneNumber: params.phoneNumber,
      jobTitle: params.jobTitle,
      department: params.department,
      websiteUrl,
      websiteScrapingStatus: websiteUrl ? 'pending' : null,
      websiteLastScrapedAt: null,
      websiteProfileData: null,
    }).returning().then(rows => rows[0]!)

    if (params.profiles?.length) {
      await tx.insert(schema.employeeSocialProfile).values(
        params.profiles.map(p => ({
          targetId: target.id,
          platform: p.platform,
          profileUrl: p.profileUrl,
        })),
      )
    }

    return target
  })
}

/**
 * Returns all employee targets for an organization.
 */
export async function listTargets(params: { orgId: string }) {
  const db = useDatabase()

  return db.query.employeeTarget.findMany({
    where: { organizationId: params.orgId },
    with: { socialProfiles: true },
  })
}

/**
 * Returns an employee target with its social profiles.
 * @throws NOT_FOUND if the target does not exist in the organization.
 */
export async function getTarget(params: { targetId: string, orgId: string }) {
  const db = useDatabase()

  const target = await db.query.employeeTarget.findFirst({
    where: { id: params.targetId, organizationId: params.orgId },
    with: { socialProfiles: true },
  })

  if (!target) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Target not found' })
  }

  return target
}

/**
 * Updates an employee target's basic info.
 * @throws NOT_FOUND if the target does not exist in the organization.
 */
export async function updateTarget(params: {
  targetId: string
  orgId: string
  data: {
    firstName?: string
    lastName?: string
    email?: string
    phoneNumber?: string
    jobTitle?: string
    department?: string
    websiteUrl?: string | null
  }
}) {
  const db = useDatabase()

  const existing = await db.query.employeeTarget.findFirst({
    where: { id: params.targetId, organizationId: params.orgId },
  })

  if (!existing) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Target not found' })
  }

  const { websiteUrl: websiteUrlPatch, ...rest } = params.data
  const patch: typeof params.data & {
    websiteProfileData?: null
    websiteLastScrapedAt?: null
    websiteScrapingStatus?: 'pending' | null
  } = { ...rest }

  if (websiteUrlPatch !== undefined) {
    const normalized = typeof websiteUrlPatch === 'string' ? websiteUrlPatch.trim() || null : null
    const prev = existing.websiteUrl ?? null
    patch.websiteUrl = normalized
    if (normalized !== prev) {
      patch.websiteProfileData = null
      patch.websiteLastScrapedAt = null
      patch.websiteScrapingStatus = normalized ? 'pending' : null
    }
  }

  if (Object.keys(patch).length === 0)
    return existing

  const [updated] = await db
    .update(schema.employeeTarget)
    .set(patch)
    .where(and(
      eq(schema.employeeTarget.id, params.targetId),
      eq(schema.employeeTarget.organizationId, params.orgId),
    ))
    .returning()

  if (!updated) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Target not found' })
  }

  return updated
}

/**
 * Deletes an employee target and cascades to profiles and scraping results.
 * @throws NOT_FOUND if the target does not exist in the organization.
 */
export async function removeTarget(params: { targetId: string, orgId: string }) {
  const db = useDatabase()

  const [deleted] = await db
    .delete(schema.employeeTarget)
    .where(and(
      eq(schema.employeeTarget.id, params.targetId),
      eq(schema.employeeTarget.organizationId, params.orgId),
    ))
    .returning()

  if (!deleted) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Target not found' })
  }

  return deleted
}

/**
 * Adds a social profile to an employee target.
 */
export async function addSocialProfile(params: {
  targetId: string
  platform: 'linkedin' | 'github' | 'twitter' | 'facebook' | 'instagram'
  profileUrl: string
}) {
  const db = useDatabase()

  return db.insert(schema.employeeSocialProfile).values({
    targetId: params.targetId,
    platform: params.platform,
    profileUrl: params.profileUrl,
  }).returning().then(rows => rows[0]!)
}

/**
 * Removes a social profile from an employee target.
 * @throws NOT_FOUND if the profile does not exist.
 */
export async function removeSocialProfile(params: { profileId: string, targetId: string }) {
  const db = useDatabase()

  const [deleted] = await db
    .delete(schema.employeeSocialProfile)
    .where(and(
      eq(schema.employeeSocialProfile.id, params.profileId),
      eq(schema.employeeSocialProfile.targetId, params.targetId),
    ))
    .returning()

  if (!deleted) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Profile not found' })
  }

  return deleted
}

/**
 * Saves a scraping result for a social profile.
 * Updates the profile's scraping status to 'completed'.
 */
export async function saveScrapingResult(params: { socialProfileId: string, data: ScrapingData }) {
  const db = useDatabase()

  return db.transaction(async (tx) => {
    const result = await tx.insert(schema.employeeScrapingResult).values({
      socialProfileId: params.socialProfileId,
      data: params.data,
    }).returning().then(rows => rows[0]!)

    await tx
      .update(schema.employeeSocialProfile)
      .set({ scrapingStatus: 'completed', lastScrapedAt: new Date() })
      .where(eq(schema.employeeSocialProfile.id, params.socialProfileId))

    return result
  })
}

/**
 * Returns scraping history for an employee target across all social profiles.
 */
export async function getScrapingResults(params: { targetId: string }) {
  const db = useDatabase()

  return db.query.employeeSocialProfile.findMany({
    where: { targetId: params.targetId },
    with: {
      scrapingResults: {
        orderBy: { scrapedAt: 'desc' },
      },
    },
  })
}

/**
 * Persists server-side website profile extraction on the target.
 * Sets website scraping status to completed.
 */
export async function saveWebsiteProfile(params: { targetId: string, data: SiteProfileExtractResult }) {
  const db = useDatabase()

  const [updated] = await db
    .update(schema.employeeTarget)
    .set({
      websiteScrapingStatus: 'completed',
      websiteLastScrapedAt: new Date(),
      websiteProfileData: params.data,
    })
    .where(eq(schema.employeeTarget.id, params.targetId))
    .returning()

  if (!updated) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Target not found' })
  }

  return updated
}

/**
 * Marks website scraping as in progress for a target.
 */
export async function markWebsiteScrapeInProgress(targetId: string) {
  const db = useDatabase()

  await db
    .update(schema.employeeTarget)
    .set({ websiteScrapingStatus: 'in_progress' })
    .where(eq(schema.employeeTarget.id, targetId))
}

/**
 * Marks website scraping as failed for a target.
 */
export async function markWebsiteScrapeFailed(targetId: string) {
  const db = useDatabase()

  await db
    .update(schema.employeeTarget)
    .set({ websiteScrapingStatus: 'failed' })
    .where(eq(schema.employeeTarget.id, targetId))
}
