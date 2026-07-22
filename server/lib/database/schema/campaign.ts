import { index, pgEnum, pgTable, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm/sql/sql'
import { users } from './auth'
import { organization } from './organization'
import { employeeTarget } from './target'

// ========== ENUMS ==========

export const campaignChannelEnum = pgEnum('campaign_channel', ['email', 'sms'])

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'completed',
])

// ========== CAMPAIGN TEMPLATES ==========

export interface LandingPageConfig {
  title: string
  brandLogo?: string
  brandColor?: string
  fields: { name: string, type: 'text' | 'email' | 'password', label: string, placeholder?: string }[]
  submitLabel: string
  redirectUrl?: string
}

export interface AttachmentConfig {
  fileName: string
  fileType: string
  storagePath?: string
}

export const campaignTemplate = pgTable(
  'campaign_template',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    organizationId: t.uuid().notNull().references(() => organization.id, { onDelete: 'cascade' }),
    name: t.text().notNull(),
    description: t.text(),
    channel: campaignChannelEnum().notNull(),
    subject: t.text(),
    content: t.text().notNull(),
    landingPageConfig: t.jsonb().$type<LandingPageConfig>(),
    attachmentConfig: t.jsonb().$type<AttachmentConfig>(),
    createdById: t.uuid().references(() => users.id, { onDelete: 'set null' }),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [
    index().on(table.organizationId),
    index().on(table.channel),
    index().on(table.createdById),
  ],
)

// ========== PHISHING CAMPAIGNS ==========

export const phishingCampaign = pgTable(
  'phishing_campaign',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    organizationId: t.uuid().notNull().references(() => organization.id, { onDelete: 'cascade' }),
    templateId: t.uuid().references(() => campaignTemplate.id, { onDelete: 'set null' }),
    name: t.text().notNull(),
    description: t.text(),
    status: campaignStatusEnum().notNull().default('draft'),
    channel: campaignChannelEnum().notNull(),
    createdById: t.uuid().notNull().references(() => users.id),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [
    index().on(table.organizationId),
    index().on(table.organizationId, table.status),
    index().on(table.templateId),
    index().on(table.createdById),
  ],
)

// ========== CAMPAIGN TARGETS ==========

export const campaignTarget = pgTable(
  'campaign_target',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    campaignId: t.uuid().notNull().references(() => phishingCampaign.id, { onDelete: 'cascade' }),
    targetId: t.uuid().notNull().references(() => employeeTarget.id, { onDelete: 'cascade' }),
    personalizedSubject: t.text(),
    personalizedContent: t.text(),
    sentAt: t.timestamp(),
    deliveredAt: t.timestamp(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  table => [
    index().on(table.campaignId),
    index().on(table.targetId),
    uniqueIndex().on(table.campaignId, table.targetId),
  ],
)
