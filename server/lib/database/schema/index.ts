import { defineRelations } from 'drizzle-orm'
import * as auth from './auth'
import * as campaign from './campaign'
import * as interaction from './interaction'
import * as organization from './organization'
import * as target from './target'

export const schema = {
  ...auth,
  ...organization,
  ...target,
  ...campaign,
  ...interaction,
}

export const relations = defineRelations(schema, r => ({
  // ===== AUTH =====
  users: {
    sessions: r.many.betterAuthSession(),
    accounts: r.many.betterAuthAccount(),
    memberships: r.many.organizationMember(),
    createdTemplates: r.many.campaignTemplate(),
    createdCampaigns: r.many.phishingCampaign(),
  },
  betterAuthSession: {
    user: r.one.users({
      from: r.betterAuthSession.userId,
      to: r.users.id,
    }),
  },
  betterAuthAccount: {
    user: r.one.users({
      from: r.betterAuthAccount.userId,
      to: r.users.id,
    }),
  },

  // ===== ORGANIZATION =====
  organization: {
    members: r.many.organizationMember(),
    employeeTargets: r.many.employeeTarget(),
    templates: r.many.campaignTemplate(),
    campaigns: r.many.phishingCampaign(),
  },
  organizationMember: {
    user: r.one.users({
      from: r.organizationMember.userId,
      to: r.users.id,
    }),
    organization: r.one.organization({
      from: r.organizationMember.organizationId,
      to: r.organization.id,
    }),
  },

  // ===== TARGET =====
  employeeTarget: {
    organization: r.one.organization({
      from: r.employeeTarget.organizationId,
      to: r.organization.id,
    }),
    socialProfiles: r.many.employeeSocialProfile(),
    campaignTargets: r.many.campaignTarget(),
  },
  employeeSocialProfile: {
    target: r.one.employeeTarget({
      from: r.employeeSocialProfile.targetId,
      to: r.employeeTarget.id,
    }),
    scrapingResults: r.many.employeeScrapingResult(),
  },
  employeeScrapingResult: {
    socialProfile: r.one.employeeSocialProfile({
      from: r.employeeScrapingResult.socialProfileId,
      to: r.employeeSocialProfile.id,
    }),
  },

  // ===== CAMPAIGN =====
  campaignTemplate: {
    organization: r.one.organization({
      from: r.campaignTemplate.organizationId,
      to: r.organization.id,
    }),
    createdBy: r.one.users({
      from: r.campaignTemplate.createdById,
      to: r.users.id,
    }),
    campaigns: r.many.phishingCampaign(),
  },
  phishingCampaign: {
    organization: r.one.organization({
      from: r.phishingCampaign.organizationId,
      to: r.organization.id,
    }),
    template: r.one.campaignTemplate({
      from: r.phishingCampaign.templateId,
      to: r.campaignTemplate.id,
    }),
    createdBy: r.one.users({
      from: r.phishingCampaign.createdById,
      to: r.users.id,
    }),
    targets: r.many.campaignTarget(),
  },
  campaignTarget: {
    campaign: r.one.phishingCampaign({
      from: r.campaignTarget.campaignId,
      to: r.phishingCampaign.id,
    }),
    target: r.one.employeeTarget({
      from: r.campaignTarget.targetId,
      to: r.employeeTarget.id,
    }),
    interactions: r.many.interactionLog(),
  },

  // ===== INTERACTION =====
  interactionLog: {
    campaignTarget: r.one.campaignTarget({
      from: r.interactionLog.campaignTargetId,
      to: r.campaignTarget.id,
    }),
  },
}))
