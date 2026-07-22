import { listCampaignInteractions } from '#server/services/interactions'
import { getOrgMembership } from '#server/services/organizations'
import { viewOrgAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), campaignId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, viewOrgAbility, { membership })
    return listCampaignInteractions({ campaignId: params.campaignId, orgId: params.orgId })
  },
})
