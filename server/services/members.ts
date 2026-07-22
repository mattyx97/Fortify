import { schema } from '#server/lib/database/schema'
import { and, eq } from 'drizzle-orm'

/**
 * Finds a user by email address.
 * @throws NOT_FOUND if no user with that email exists.
 */
export async function findUserByEmail(params: { email: string }) {
  const db = useDatabase()

  const user = await db.query.users.findFirst({
    where: { email: params.email },
  })

  if (!user) {
    throw createAppError(404, { code: 'USER_NOT_FOUND', message: 'No user found with that email' })
  }

  return user
}

/**
 * Returns all members of an organization with their user info.
 */
export async function listOrgMembers(params: { orgId: string }) {
  const db = useDatabase()

  return db.query.organizationMember.findMany({
    where: { organizationId: params.orgId },
    with: { user: true },
  })
}

/**
 * Adds a user to an organization with a given role.
 * @throws MEMBER_EXISTS if the user is already a member.
 */
export async function addOrgMember(params: { orgId: string, userId: string, role: 'company_admin' | 'analyst' }) {
  const db = useDatabase()

  const existing = await db.query.organizationMember.findFirst({
    where: {
      userId: params.userId,
      organizationId: params.orgId,
    },
  })

  if (existing) {
    throw createAppError(409, { code: 'MEMBER_EXISTS', message: 'User is already a member of this organization' })
  }

  return db.insert(schema.organizationMember).values({
    organizationId: params.orgId,
    userId: params.userId,
    role: params.role,
  }).returning().then(rows => rows[0]!)
}

/**
 * Updates the role of an organization member.
 * @throws NOT_FOUND if the member does not exist.
 * @throws SELF_DOWNGRADE if trying to downgrade own role.
 */
export async function updateMemberRole(params: { memberId: string, orgId: string, role: 'company_admin' | 'analyst', actorUserId: string }) {
  const db = useDatabase()

  // Check if trying to downgrade self
  const target = await db.query.organizationMember.findFirst({
    where: { id: params.memberId, organizationId: params.orgId },
  })

  if (target?.userId === params.actorUserId && params.role !== target.role) {
    throw createAppError(403, { code: 'SELF_DOWNGRADE', message: 'You cannot change your own role' })
  }

  const [updated] = await db
    .update(schema.organizationMember)
    .set({ role: params.role })
    .where(and(
      eq(schema.organizationMember.id, params.memberId),
      eq(schema.organizationMember.organizationId, params.orgId),
    ))
    .returning()

  if (!updated) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Member not found' })
  }

  return updated
}

/**
 * Removes a member from an organization.
 * @throws NOT_FOUND if the member does not exist.
 */
export async function removeOrgMember(params: { memberId: string, orgId: string }) {
  const db = useDatabase()

  const [deleted] = await db
    .delete(schema.organizationMember)
    .where(and(
      eq(schema.organizationMember.id, params.memberId),
      eq(schema.organizationMember.organizationId, params.orgId),
    ))
    .returning()

  if (!deleted) {
    throw createAppError(404, { code: 'NOT_FOUND', message: 'Member not found' })
  }

  return deleted
}
