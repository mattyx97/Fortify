import type { IBetterAuthUser } from '#server/lib/better-auth'

interface OrgContext { membership: { role: string } | null }

function isOrgMember(ctx: OrgContext) {
  return !!ctx.membership
}

function isOrgAdmin(ctx: OrgContext) {
  return ctx.membership?.role === 'company_admin'
}

// ===== BASE =====

export const viewOrgAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgMember(ctx))
    return deny({ statusCode: 403, message: 'You are not a member of this organization' })
  return true
})

// ===== MEMBERS =====

export const listMembersAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgMember(ctx))
    return deny({ statusCode: 403, message: 'Not a member' })
  return true
})

export const manageMembersAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgAdmin(ctx))
    return deny({ statusCode: 403, message: 'Only company admins can manage members' })
  return true
})

// ===== TARGETS =====

export const listTargetsAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgMember(ctx))
    return deny({ statusCode: 403, message: 'Not a member' })
  return true
})

export const viewTargetAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgMember(ctx))
    return deny({ statusCode: 403, message: 'Not a member' })
  return true
})

export const createTargetAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgAdmin(ctx))
    return deny({ statusCode: 403, message: 'Only company admins can create targets' })
  return true
})

export const editTargetAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgAdmin(ctx))
    return deny({ statusCode: 403, message: 'Only company admins can edit targets' })
  return true
})

export const deleteTargetAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgAdmin(ctx))
    return deny({ statusCode: 403, message: 'Only company admins can delete targets' })
  return true
})

// ===== SOCIAL PROFILES =====

export const manageProfilesAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgAdmin(ctx))
    return deny({ statusCode: 403, message: 'Only company admins can manage profiles' })
  return true
})

// ===== SCRAPING =====

export const triggerScrapeAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgAdmin(ctx))
    return deny({ statusCode: 403, message: 'Only company admins can trigger scraping' })
  return true
})

export const viewScrapingResultsAbility = defineAbility((user: IBetterAuthUser, ctx: OrgContext) => {
  if (!isOrgMember(ctx))
    return deny({ statusCode: 403, message: 'Not a member' })
  return true
})
