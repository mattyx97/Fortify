import type { AttachmentConfig } from '#server/lib/database/schema/campaign'
import { DEFAULT_TEMPLATES } from '#server/lib/campaign/default-templates'
import { schema } from '#server/lib/database/schema'
import { eq } from 'drizzle-orm'

/**
 * Creates a new organization, assigns the creator as company_admin,
 * seeds default campaign templates, and uploads default attachments to S3.
 * Uploads: default PDF attachments to S3 drive.
 */
export async function createOrganization(params: { name: string, creatorUserId: string }) {
  const db = useDatabase()

  const { org, templates } = await db.transaction(async (tx) => {
    const org = await tx.insert(schema.organization).values({ name: params.name }).returning().then(rows => rows[0]!)

    await tx.insert(schema.organizationMember).values({
      userId: params.creatorUserId,
      organizationId: org.id,
      role: 'company_admin',
    })

    const templates = await tx.insert(schema.campaignTemplate).values(
      DEFAULT_TEMPLATES.map(t => ({
        organizationId: org.id,
        name: t.name,
        description: t.description,
        channel: t.channel,
        subject: t.subject,
        content: t.content,
        landingPageConfig: t.landingPageConfig,
        createdById: params.creatorUserId,
      })),
    ).returning()

    return { org, templates }
  })

  // Upload default attachments outside the transaction
  const disk = useDrive().use()
  const assets = useStorage('assets:campaign')
  for (const defaultTemplate of DEFAULT_TEMPLATES) {
    if (!defaultTemplate.attachmentAsset)
      continue

    const created = templates.find(t => t.name === defaultTemplate.name)
    if (!created)
      continue

    try {
      const raw = await assets.getItemRaw<Buffer | Uint8Array>(defaultTemplate.attachmentAsset.assetFile)
      if (!raw) {
        useLogger().error(`[createOrganization] Default attachment asset not found: ${defaultTemplate.attachmentAsset.assetFile}`)
        continue
      }
      const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
      const storagePath = `templates/${org.id}/${created.id}.pdf`
      await disk.put(storagePath, buffer, { contentType: 'application/pdf' })

      const attachmentConfig: AttachmentConfig = {
        fileName: defaultTemplate.attachmentAsset.fileName,
        fileType: 'application/pdf',
        storagePath,
      }
      await db.update(schema.campaignTemplate)
        .set({ attachmentConfig })
        .where(eq(schema.campaignTemplate.id, created.id))
    }
    catch (err) {
      useLogger().error(`[createOrganization] Failed to upload default attachment for template ${created.name}`, err)
    }
  }

  return org
}

/**
 * Returns all organizations the user belongs to, with their role in each.
 */
export async function listUserOrganizations(params: { userId: string }) {
  const db = useDatabase()

  return db.query.organizationMember.findMany({
    where: { userId: params.userId },
    with: { organization: true },
  })
}

/**
 * Returns an organization by ID.
 * @throws NOT_FOUND if the organization does not exist.
 */
export async function getOrganization(params: { orgId: string }) {
  const db = useDatabase()

  const org = await db.query.organization.findFirst({
    where: { id: params.orgId },
  })

  if (!org) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Organization not found' })
  }

  return org
}

/**
 * Returns the membership record for a user in an organization, or null.
 */
export async function getOrgMembership(params: { userId: string, orgId: string }) {
  const db = useDatabase()

  return db.query.organizationMember.findFirst({
    where: {
      userId: params.userId,
      organizationId: params.orgId,
    },
  }) ?? null
}
