import { launchCampaign, updateCampaignStatus } from '#server/services/campaigns'
import { getOrgMembership } from '#server/services/organizations'
import { createTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), campaignId: z.string().uuid() })
const bodySchema = z.object({
  status: z.enum(['draft', 'active', 'completed']),
})

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, createTargetAbility, { membership })

    if (body.status === 'active') {
      const baseUrl = getRequestURL(event).origin
      return launchCampaign({ campaignId: params.campaignId, orgId: params.orgId, baseUrl })
    }

    return updateCampaignStatus({ campaignId: params.campaignId, orgId: params.orgId, status: body.status })
  },
})
