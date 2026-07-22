import { index, pgTable } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm/sql/sql'

export const users = pgTable(
  'users',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    name: t.text().notNull(),
    email: t.text().notNull().unique(),
    emailVerified: t.boolean().default(false).notNull(),
    image: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
)

export const betterAuthSession = pgTable(
  'better_auth_session',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    expiresAt: t.timestamp().notNull(),
    token: t.text().notNull().unique(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: t.text(),
    userAgent: t.text(),
    userId: t.uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  }),
  table => [index().on(table.userId)],
)

export const betterAuthAccount = pgTable(
  'better_auth_account',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    accountId: t.text().notNull(),
    providerId: t.text().notNull(),
    userId: t.uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: t.text(),
    refreshToken: t.text(),
    idToken: t.text(),
    accessTokenExpiresAt: t.timestamp(),
    refreshTokenExpiresAt: t.timestamp(),
    scope: t.text(),
    password: t.text(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [index().on(table.userId)],
)

export const betterAuthVerification = pgTable(
  'better_auth_verification',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    identifier: t.text().notNull(),
    value: t.text().notNull(),
    expiresAt: t.timestamp().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [index().on(table.identifier)],
)
