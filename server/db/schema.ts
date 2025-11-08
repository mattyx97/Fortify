import {
  pgTable,
  text,
  integer,
  timestamp,
  varchar,
  boolean,
  uuid,
  json,
  decimal,
  primaryKey,
  date,
  PgTable,
  index,
} from "drizzle-orm/pg-core";

// ========== FORTIFY PLATFORM TABLES ==========

export const organization = pgTable("organization", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ========== BETTER AUTH TABLES ==========

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  role: text("role").notNull().default("company_admin"), // admin, company_admin, analyst
  organizationId: uuid("organization_id").references(() => organization.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
}, (table) => ({
  orgIdx: index("user_org_idx").on(table.organizationId),
}));

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // Campo richiesto dal plugin admin per impersonation
  impersonatedBy: text("impersonated_by"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ========== EMPLOYEE TARGETS & SOCIAL PROFILES ==========

export const employeeTarget = pgTable("employee_target", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  email: text("email").notNull(),
  posizione: text("posizione"),
  dipartimento: text("dipartimento"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  emailOrgIdx: index("employee_email_org_idx").on(table.email, table.organizationId),
}));

export const socialProfile = pgTable("social_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetId: uuid("target_id")
    .notNull()
    .references(() => employeeTarget.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // linkedin, facebook, twitter, instagram
  profileUrl: text("profile_url").notNull(),
  lastScrapedAt: timestamp("last_scraped_at"),
  scrapingStatus: text("scraping_status").notNull().default("pending"), // pending, in_progress, completed, failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  targetPlatformIdx: index("social_target_platform_idx").on(table.targetId, table.platform),
}));

export const scrapingHistory = pgTable("scraping_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  socialProfileId: uuid("social_profile_id")
    .notNull()
    .references(() => socialProfile.id, { onDelete: "cascade" }),
  rawData: json("raw_data").notNull(),
  scrapedAt: timestamp("scraped_at").notNull().defaultNow(),
  version: integer("version").notNull(),
}, (table) => ({
  profileVersionIdx: index("scraping_profile_version_idx").on(table.socialProfileId, table.version),
}));

// ========== PHISHING CAMPAIGNS ==========

export const phishingCampaign = pgTable("phishing_campaign", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  nome: text("nome").notNull(),
  descrizione: text("descrizione"),
  status: text("status").notNull().default("draft"), // draft, scheduled, launched, completed
  campaignType: text("campaign_type").notNull().default("password_reset"), // password_reset, invoice, executive_impersonation, urgent_request
  createdById: text("created_by_id")
    .notNull()
    .references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  launchedAt: timestamp("launched_at"),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  orgStatusIdx: index("campaign_org_status_idx").on(table.organizationId, table.status),
}));

export const campaignTarget = pgTable("campaign_target", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => phishingCampaign.id, { onDelete: "cascade" }),
  targetId: uuid("target_id")
    .notNull()
    .references(() => employeeTarget.id, { onDelete: "cascade" }),
  personalizedMessage: text("personalized_message"),
  emailSubject: text("email_subject"),
  sentAt: timestamp("sent_at"),
  clickedAt: timestamp("clicked_at"),
  submittedAt: timestamp("submitted_at"),
  trackingUuid: uuid("tracking_uuid").defaultRandom().notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  campaignTargetIdx: index("campaign_target_idx").on(table.campaignId, table.targetId),
  trackingIdx: index("tracking_uuid_idx").on(table.trackingUuid),
}));

export const interactionLog = pgTable("interaction_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignTargetId: uuid("campaign_target_id")
    .notNull()
    .references(() => campaignTarget.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // email_sent, link_clicked, credentials_submitted, page_viewed, attachment_downloaded
  data: json("data"), // Additional metadata (IP, user-agent, etc.)
  timestamp: timestamp("timestamp").notNull().defaultNow(),
}, (table) => ({
  campaignTargetTypeIdx: index("interaction_campaign_type_idx").on(table.campaignTargetId, table.type),
  timestampIdx: index("interaction_timestamp_idx").on(table.timestamp),
}));
