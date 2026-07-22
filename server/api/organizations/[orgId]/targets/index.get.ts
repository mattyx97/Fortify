import { getOrgMembership } from '#server/services/organizations'
import { listTargets } from '#server/services/targets'
import { listTargetsAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid() })

export default defineAuthEventHandler({
  input: { params: paramsSchema },
  async handler(event, { input: { params }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, listTargetsAbility, { membership })
    return listTargets({ orgId: params.orgId })
  },
})
