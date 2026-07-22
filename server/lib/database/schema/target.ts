import type { SiteProfileExtractResult } from '#server/services/site-profile-extract'
import { index, pgEnum, pgTable } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm/sql/sql'
import { organization } from './organization'

// ========== ENUMS ==========

export const platformEnum = pgEnum('platform', ['linkedin', 'github', 'twitter', 'facebook', 'instagram'])

export const scrapingStatusEnum = pgEnum('scraping_status', ['pending', 'in_progress', 'completed', 'failed'])

// ========== EMPLOYEE TARGETS & SOCIAL PROFILES ==========

export const employeeTarget = pgTable(
  'employee_target',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    organizationId: t.uuid().notNull().references(() => organization.id, { onDelete: 'cascade' }),
    firstName: t.text().notNull(),
    lastName: t.text().notNull(),
    email: t.text().notNull(),
    phoneNumber: t.text(),
    jobTitle: t.text(),
    department: t.text(),
    websiteUrl: t.text(),
    websiteScrapingStatus: scrapingStatusEnum(),
    websiteLastScrapedAt: t.timestamp(),
    websiteProfileData: t.jsonb(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [
    index().on(table.organizationId),
    index().on(table.email, table.organizationId),
  ],
)

export const employeeSocialProfile = pgTable(
  'employee_social_profile',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    targetId: t.uuid().notNull().references(() => employeeTarget.id, { onDelete: 'cascade' }),
    platform: platformEnum().notNull(),
    profileUrl: t.text().notNull(),
    username: t.text(),
    scrapingStatus: scrapingStatusEnum().notNull().default('pending'),
    lastScrapedAt: t.timestamp(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [
    index().on(table.targetId),
    index().on(table.targetId, table.platform),
  ],
)

export const employeeScrapingResult = pgTable(
  'employee_scraping_result',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    socialProfileId: t.uuid().notNull().references(() => employeeSocialProfile.id, { onDelete: 'cascade' }),
    data: t.jsonb().$type<ScrapingData>().notNull(),
    scrapedAt: t.timestamp().defaultNow().notNull(),
  }),
  table => [
    index().on(table.socialProfileId),
  ],
)

// ========== SCRAPING DATA TYPES ==========

export interface LinkedInScrapingData {
  platform: 'linkedin'
  fullName: string | null
  headline: string | null
  location: string | null
  bio: string | null
  experiences: { title: string, company: string, duration: string, current: boolean }[]
  education: { school: string, degree: string }[]
  skills: string[]
  projects: { name: string, description: string }[]
  languages: string[]
  certifications: string[]
  volunteering: string[]
  activity: {
    type: 'post' | 'repost'
    content: string
    originalAuthor: string | null
    /** e.g. "2 settimane fa" / "1w" when parsed from the feed */
    relativeTime?: string | null
  }[]
}

export interface GitHubRepoScraped {
  name: string
  description: string
  language: string
  stars: number
  forks: number
  url: string
  /** Testo README principale (solo repo pubblici / pagina accessibile senza login) */
  readmePreview?: string | null
  /** Contributori visibili (sidebar o /graphs/contributors); repo privati restano vuoti */
  contributors?: { login: string, profileUrl: string }[]
}

export interface GitHubScrapingData {
  platform: 'github'
  username: string | null
  fullName: string | null
  bio: string | null
  location: string | null
  company: string | null
  followers: number | null
  following: number | null
  repositories: GitHubRepoScraped[]
  pinnedRepos: string[]
}

export interface WebsiteScrapingData {
  platform: 'website'
  data: SiteProfileExtractResult
}

export type ScrapingData = LinkedInScrapingData | GitHubScrapingData | WebsiteScrapingData
