import { updateMemberRole } from '#server/services/members'
import { getOrgMembership } from '#server/services/organizations'
import { manageMembersAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid(), memberId: z.string().uuid() })
const bodySchema = z.object({
  role: z.enum(['company_admin', 'analyst']),
})

export type TUpdateMemberBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, manageMembersAbility, { membership })
    return updateMemberRole({ memberId: params.memberId, orgId: params.orgId, role: body.role, actorUserId: user.id })
  },
})
