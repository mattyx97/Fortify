import { getCampaign } from '#server/services/campaigns'
import { getOrgMembership } from '#server/services/organizations'
import { viewOrgAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), campaignId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, viewOrgAbility, { membership })
    return getCampaign({ campaignId: params.campaignId, orgId: params.orgId })
  },
})
