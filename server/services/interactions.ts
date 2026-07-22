import type { InteractionMetadata } from '#server/lib/database/schema/interaction'
import { schema } from '#server/lib/database/schema'

/**
 * Records an interaction event for a campaign target.
 * Silently skips the log if the parent campaign is already completed.
 */
export async function logInteraction(params: {
  campaignTargetId: string
  eventType: 'email_opened' | 'link_clicked' | 'form_submitted' | 'payload_executed'
  metadata?: InteractionMetadata
}) {
  const db = useDatabase()

  // Verify the campaign is still accepting interactions
  const ct = await db.query.campaignTarget.findFirst({
    where: { id: params.campaignTargetId },
    with: { campaign: true },
  })

  if (!ct || !ct.campaign)
    return null
  if (ct.campaign.status === 'completed')
    return null

  return db.insert(schema.interactionLog).values({
    campaignTargetId: params.campaignTargetId,
    eventType: params.eventType,
    metadata: params.metadata,
  }).returning().then(rows => rows[0]!)
}

/**
 * Returns all interaction logs for a campaign, grouped by campaign target.
 * @throws NOT_FOUND if the campaign does not belong to the given organization.
 */
export async function listCampaignInteractions(params: { campaignId: string, orgId: string }) {
  const db = useDatabase()

  // Scope by org so a member of one organization cannot read another org's
  // captured credentials / call transcripts by guessing a campaign id.
  const campaign = await db.query.phishingCampaign.findFirst({
    where: { id: params.campaignId, organizationId: params.orgId },
    columns: { id: true },
  })
  if (!campaign) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Campaign not found' })
  }

  return db.query.campaignTarget.findMany({
    where: { campaignId: params.campaignId },
    with: {
      target: true,
      interactions: true,
    },
  })
}
