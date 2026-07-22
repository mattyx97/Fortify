import { getOrgMembership } from '#server/services/organizations'
import { getScrapingResults, getTarget } from '#server/services/targets'
import { viewScrapingResultsAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), targetId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, viewScrapingResultsAbility, { membership })
    await getTarget({ targetId: params.targetId, orgId: params.orgId })
    return getScrapingResults({ targetId: params.targetId })
  },
})
