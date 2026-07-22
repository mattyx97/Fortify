import type { AttachmentConfig, LandingPageConfig } from '#server/lib/database/schema/campaign'
import { schema } from '#server/lib/database/schema'
import { and, eq } from 'drizzle-orm'

/**
 * Returns all campaign templates for an organization.
 */
export async function listTemplates(params: { orgId: string }) {
  const db = useDatabase()

  return db.query.campaignTemplate.findMany({
    where: { organizationId: params.orgId },
  })
}

/**
 * Returns a campaign template by ID.
 * @throws NOT_FOUND if the template does not exist.
 */
export async function getTemplate(params: { templateId: string, orgId: string }) {
  const db = useDatabase()

  const template = await db.query.campaignTemplate.findFirst({
    where: { id: params.templateId, organizationId: params.orgId },
  })

  if (!template) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Template not found' })
  }

  return template
}

/**
 * Creates a new campaign template.
 */
export async function createTemplate(params: {
  orgId: string
  name: string
  description?: string
  channel: 'email' | 'sms'
  subject?: string
  content: string
  landingPageConfig?: typeof schema.campaignTemplate.$inferInsert['landingPageConfig']
  attachmentConfig?: typeof schema.campaignTemplate.$inferInsert['attachmentConfig']
  createdById: string
}) {
  const db = useDatabase()

  return db.insert(schema.campaignTemplate).values({
    organizationId: params.orgId,
    name: params.name,
    description: params.description,
    channel: params.channel,
    subject: params.subject,
    content: params.content,
    landingPageConfig: params.landingPageConfig,
    attachmentConfig: params.attachmentConfig,
    createdById: params.createdById,
  }).returning().then(rows => rows[0]!)
}

/**
 * Updates a campaign template.
 * Preserves the existing attachment storagePath if the new attachmentConfig doesn't include one.
 * @throws NOT_FOUND if the template does not exist.
 */
export async function updateTemplate(params: {
  templateId: string
  orgId: string
  data: {
    name?: string
    description?: string
    subject?: string
    content?: string
    landingPageConfig?: LandingPageConfig | null
    attachmentConfig?: AttachmentConfig | null
  }
}) {
  const db = useDatabase()

  // Preserve existing storagePath when updating attachmentConfig without it
  const updateData = { ...params.data }
  if (updateData.attachmentConfig && !updateData.attachmentConfig.storagePath) {
    const existing = await db.query.campaignTemplate.findFirst({
      where: { id: params.templateId, organizationId: params.orgId },
      columns: { attachmentConfig: true },
    })
    if (existing?.attachmentConfig?.storagePath) {
      updateData.attachmentConfig = {
        ...updateData.attachmentConfig,
        storagePath: existing.attachmentConfig.storagePath,
      }
    }
  }

  const [updated] = await db
    .update(schema.campaignTemplate)
    .set(updateData)
    .where(and(
      eq(schema.campaignTemplate.id, params.templateId),
      eq(schema.campaignTemplate.organizationId, params.orgId),
    ))
    .returning()

  if (!updated) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Template not found' })
  }

  return updated
}

/**
 * Deletes a campaign template.
 * @throws NOT_FOUND if the template does not exist.
 */
export async function deleteTemplate(params: { templateId: string, orgId: string }) {
  const db = useDatabase()

  const [deleted] = await db
    .delete(schema.campaignTemplate)
    .where(and(
      eq(schema.campaignTemplate.id, params.templateId),
      eq(schema.campaignTemplate.organizationId, params.orgId),
    ))
    .returning()

  if (!deleted) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Template not found' })
  }

  return deleted
}

/**
 * Returns all campaigns for an organization with target count.
 */
export async function listCampaigns(params: { orgId: string }) {
  const db = useDatabase()

  return db.query.phishingCampaign.findMany({
    where: { organizationId: params.orgId },
    with: { template: true, createdBy: true },
  })
}

/**
 * Returns a campaign with its targets and template.
 * @throws NOT_FOUND if the campaign does not exist.
 */
export async function getCampaign(params: { campaignId: string, orgId: string }) {
  const db = useDatabase()

  const campaign = await db.query.phishingCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.orgId },
    with: {
      template: true,
      createdBy: true,
      targets: { with: { target: true } },
    },
  })

  if (!campaign) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Campaign not found' })
  }

  return campaign
}

/**
 * Creates a new campaign in draft status.
 */
export async function createCampaign(params: {
  orgId: string
  name: string
  description?: string
  templateId: string
  channel: 'email' | 'sms'
  targetIds: string[]
  createdById: string
}) {
  const db = useDatabase()

  return db.transaction(async (tx) => {
    const campaign = await tx.insert(schema.phishingCampaign).values({
      organizationId: params.orgId,
      name: params.name,
      description: params.description,
      templateId: params.templateId,
      channel: params.channel,
      createdById: params.createdById,
    }).returning().then(rows => rows[0]!)

    if (params.targetIds.length) {
      await tx.insert(schema.campaignTarget).values(
        params.targetIds.map(targetId => ({
          campaignId: campaign.id,
          targetId,
        })),
      )
    }

    return campaign
  })
}

/**
 * Updates campaign status.
 * @throws NOT_FOUND if the campaign does not exist.
 */
export async function updateCampaignStatus(params: {
  campaignId: string
  orgId: string
  status: 'draft' | 'active' | 'completed'
}) {
  const db = useDatabase()

  const [updated] = await db
    .update(schema.phishingCampaign)
    .set({ status: params.status })
    .where(and(
      eq(schema.phishingCampaign.id, params.campaignId),
      eq(schema.phishingCampaign.organizationId, params.orgId),
    ))
    .returning()

  if (!updated) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Campaign not found' })
  }

  return updated
}

/**
 * Deletes a campaign (only if draft).
 * @throws NOT_FOUND if the campaign does not exist.
 * @throws CAMPAIGN_ACTIVE if the campaign is not in draft status.
 */
export async function deleteCampaign(params: { campaignId: string, orgId: string }) {
  const db = useDatabase()

  const campaign = await db.query.phishingCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.orgId },
  })

  if (!campaign) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Campaign not found' })
  }

  if (campaign.status !== 'draft') {
    throw createAppError(400, { code: 'CAMPAIGN_ACTIVE', message: 'Only draft campaigns can be deleted' })
  }

  await db.delete(schema.phishingCampaign).where(eq(schema.phishingCampaign.id, params.campaignId))

  return campaign
}

/**
 * Uploads a base PDF to S3 and updates the template's attachmentConfig with the storage path.
 * Uploads: PDF to S3 drive.
 * @throws NOT_FOUND if the template does not exist.
 */
export async function uploadTemplateAttachment(params: {
  templateId: string
  orgId: string
  file: File
}) {
  const db = useDatabase()
  const template = await getTemplate({ templateId: params.templateId, orgId: params.orgId })

  const disk = useDrive().use()
  const storagePath = `templates/${params.orgId}/${params.templateId}.pdf`
  const buffer = Buffer.from(await params.file.arrayBuffer())
  await disk.put(storagePath, buffer, { contentType: 'application/pdf' })

  const currentConfig = (template.attachmentConfig as AttachmentConfig | null) || { fileName: params.file.name, fileType: 'application/pdf' }

  const [updated] = await db
    .update(schema.campaignTemplate)
    .set({
      attachmentConfig: {
        ...currentConfig,
        fileName: currentConfig.fileName || params.file.name,
        fileType: currentConfig.fileType || 'application/pdf',
        storagePath,
      },
    })
    .where(eq(schema.campaignTemplate.id, params.templateId))
    .returning()

  return updated
}

/**
 * Removes the base PDF from S3 and clears the storage path from attachmentConfig.
 * @throws NOT_FOUND if the template does not exist.
 */
export async function deleteTemplateAttachment(params: { templateId: string, orgId: string }) {
  const db = useDatabase()
  const template = await getTemplate({ templateId: params.templateId, orgId: params.orgId })

  const config = template.attachmentConfig as AttachmentConfig | null
  if (config?.storagePath) {
    const disk = useDrive().use()
    await disk.delete(config.storagePath)
  }

  const [updated] = await db
    .update(schema.campaignTemplate)
    .set({
      attachmentConfig: config
        ? { fileName: config.fileName, fileType: config.fileType }
        : null,
    })
    .where(eq(schema.campaignTemplate.id, params.templateId))
    .returning()

  return updated
}

/**
 * Launches a campaign: sets status to active immediately and triggers background processing.
 * The Nitro task handles AI personalization, email assembly, and sending.
 * @throws NOT_FOUND if the campaign does not exist.
 * @throws CAMPAIGN_NOT_DRAFT if campaign is not in draft status.
 * @throws TEMPLATE_MISSING if the campaign has no template.
 */
export async function launchCampaign(params: {
  campaignId: string
  orgId: string
  baseUrl: string
}) {
  const campaign = await getCampaign({ campaignId: params.campaignId, orgId: params.orgId })

  if (campaign.status !== 'draft') {
    throw createAppError(400, { code: 'CAMPAIGN_NOT_DRAFT', message: 'Campaign must be in draft status to launch' })
  }

  if (!campaign.template) {
    throw createAppError(400, { code: 'TEMPLATE_MISSING', message: 'Campaign has no template assigned' })
  }

  // Set active immediately
  const updated = await updateCampaignStatus({ campaignId: params.campaignId, orgId: params.orgId, status: 'active' })

  // Fire-and-forget background task
  runTask('campaign:launch', {
    payload: { campaignId: params.campaignId, orgId: params.orgId, baseUrl: params.baseUrl },
  }).catch((err) => {
    useLogger().error(`[launchCampaign] Background task failed for campaign ${params.campaignId}`, err)
  })

  return updated
}
