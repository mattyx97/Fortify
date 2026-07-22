import type { IDatabase } from '../database'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { schema } from '../database/schema'

export type IBetterAuth = ReturnType<typeof setupBetterAuth>
export function setupBetterAuth(config: { appName: string, secret: string, database: IDatabase, baseURL: string }) {
  return betterAuth({
    baseURL: config.baseURL,
    appName: config.appName,
    secret: config.secret,
    database: drizzleAdapter(config.database, {
      provider: 'pg',
      schema: {
        user: schema.users,
        account: schema.betterAuthAccount,
        session: schema.betterAuthSession,
        verification: schema.betterAuthVerification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
    },
    advanced: {
      database: {
        generateId: 'uuid',
      },
    },
  })
}

export type IBetterAuthIdentity = IBetterAuth['$Infer']['Session']
export type IBetterAuthSession = IBetterAuthIdentity['session']
export type IBetterAuthUser = IBetterAuthIdentity['user']
