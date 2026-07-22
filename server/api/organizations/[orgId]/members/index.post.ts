import { addOrgMember, findUserByEmail } from '#server/services/members'
import { getOrgMembership } from '#server/services/organizations'
import { manageMembersAbility } from '#shared/utils/abilities/org-member'
import { z } from 'zod'

const paramsSchema = z.object({ orgId: z.string().uuid() })
const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['company_admin', 'analyst']),
})

export type TAddMemberBody = z.infer<typeof bodySchema>

export default defineAuthEventHandler({
  input: { params: paramsSchema, body: bodySchema },
  async handler(event, { input: { params, body }, identity: { user } }) {
    const membership = await getOrgMembership({ userId: user.id, orgId: params.orgId })
    await authorize(event, manageMembersAbility, { membership })
    const targetUser = await findUserByEmail({ email: body.email })
    return addOrgMember({ orgId: params.orgId, userId: targetUser.id, role: body.role })
  },
})
