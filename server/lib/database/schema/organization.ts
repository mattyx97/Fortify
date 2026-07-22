import { index, pgEnum, pgTable, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm/sql/sql'
import { users } from './auth'

export const organization = pgTable(
  'organization',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    name: t.text().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
)

export const memberRoleEnum = pgEnum('member_role', ['company_admin', 'analyst'])

export const organizationMember = pgTable(
  'organization_member',
  t => ({
    id: t.uuid().primaryKey().default(sql`uuidv7()`),
    userId: t.uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
    organizationId: t.uuid().notNull().references(() => organization.id, { onDelete: 'cascade' }),
    role: memberRoleEnum().notNull(),
    createdAt: t.timestamp().defaultNow().notNull(),
    updatedAt: t.timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }),
  table => [
    uniqueIndex().on(table.userId, table.organizationId),
    index().on(table.organizationId),
  ],
)
