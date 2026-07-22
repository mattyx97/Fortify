import { deleteCampaign } from '#server/services/campaigns'
import { getOrgMembership } from '#server/services/organizations'
import { createTargetAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), campaignId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, createTargetAbility, { membership })
    return deleteCampaign({ campaignId: params.campaignId, orgId: params.orgId })
  },
})
