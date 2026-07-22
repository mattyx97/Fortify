import { index, pgEnum, pgTable } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm/sql/sql'
import { campaignTarget } from './campaign'

// ========== EVENT TYPE ENUM ==========

export const interactionEventEnum = pgEnum('interaction_event', [
  'email_opened', // Email
  'link_clicked', // Email, SMS
  'form_submitted', // Email, SMS
  'payload_executed', // Email
])

// ========== INTERACTION LOG ==========

export const interactionLog = pgTable(
  'interaction_log',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    campaignTargetId: t.uuid().notNull().references(() => campaignTarget.id, { onDelete: 'cascade' }),
    eventType: interactionEventEnum().notNull(),
    metadata: t.jsonb().$type<InteractionMetadata>(),
    createdAt: t.timestamp().defaultNow().notNull(),
  }),
  table => [
    index().on(table.campaignTargetId),
    index().on(table.campaignTargetId, table.eventType),
    index().on(table.createdAt),
  ],
)

// ========== TYPED METADATA PER EVENT ==========

interface BaseMetadata {
  ip?: string
  userAgent?: string
}

export interface EmailOpenedMetadata extends BaseMetadata {
  event: 'email_opened'
}

export interface LinkClickedMetadata extends BaseMetadata {
  event: 'link_clicked'
  url: string
}

export interface FormSubmittedMetadata extends BaseMetadata {
  event: 'form_submitted'
  fields: Record<string, string>
}

export interface PayloadExecutedMetadata extends BaseMetadata {
  event: 'payload_executed'
  fileName?: string
  os?: string
  hostname?: string
}

export type InteractionMetadata
  = | EmailOpenedMetadata
    | LinkClickedMetadata
    | FormSubmittedMetadata
    | PayloadExecutedMetadata
