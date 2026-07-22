import { getOrgMembership } from '#server/services/organizations'
import { resetProfilesToPending, resetWebsiteScrapeToPending } from '#server/services/scraping'
import { getTarget } from '#server/services/targets'
import { triggerScrapeAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), targetId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, triggerScrapeAbility, { membership })
    const target = await getTarget({ targetId: params.targetId, orgId: params.orgId })
    await resetProfilesToPending(params.targetId)
    await resetWebsiteScrapeToPending(params.targetId)
    const websiteQueued = target.websiteUrl ? 1 : 0
    return { queued: target.socialProfiles.length + websiteQueued }
  },
})
