import { cp } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  future: {
    compatibilityVersion: 5,
  },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@nuxt/icon', '@nuxt/image', '@nuxt/fonts', 'nuxt-authorization', 'nuxt-email-renderer', '@vueuse/nuxt'],
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    NODE_ENV: process.env.NODE_ENV,
    ...stripNuxtPrefix(
      z.object({
        // ----------------------
        // PRIVATE ENV
        // ----------------------

        // LOGGER
        NUXT_LOGGER_DISCORD_WEBHOOK_URL: z.string().optional(),

        // DATABASE
        NUXT_DATABASE_URL: z.url(),
        NUXT_DATABASE_LOGGER: z.coerce.boolean(),

        // BETTER AUTH
        NUXT_BETTER_AUTH_SECRET: z.string(),
        NUXT_BETTER_AUTH_APP_NAME: z.string(),

        // MAILER
        NUXT_MAILER_SMTP_FROM: z.string(),
        NUXT_MAILER_SMTP_HOST: z.string(),
        NUXT_MAILER_SMTP_PORT: z.coerce.number(),
        NUXT_MAILER_SMTP_SECURE: z.coerce.boolean(),
        NUXT_MAILER_SMTP_USER: z.string(),
        NUXT_MAILER_SMTP_PASS: z.string(),

        // DRIVE
        NUXT_DRIVE_S3_BUCKET: z.string(),
        NUXT_DRIVE_S3_ACCESS_KEY_ID: z.string(),
        NUXT_DRIVE_S3_SECRET_ACCESS_KEY: z.string(),
        NUXT_DRIVE_S3_REGION: z.string(),
        NUXT_DRIVE_S3_ENDPOINT: z.string().optional(),
        NUXT_DRIVE_S3_CDN_URL: z.string().optional(),

        // STRIPE
        NUXT_STRIPE_SECRET_KEY: z.string(),
        NUXT_STRIPE_WEBHOOK_SECRET_KEY: z.string(),

        // AI
        NUXT_AI_GEMINI_API_KEY: z.string(),

        // SMS (BulkGate) — optional; SMS falls back to console simulation if unset
        NUXT_BULKGATE_APPLICATION_ID: z.string().optional(),
        NUXT_BULKGATE_APPLICATION_TOKEN: z.string().optional(),
      }).parse(process.env),
    ),
    public: stripNuxtPrefix(
      z.object({
        // ----------------------
        // PUBLIC ENV
        // ----------------------

        // BETTER AUTH
        NUXT_PUBLIC_BETTER_AUTH_BASE_URL: z.string(),
      }).parse(process.env),
    ),
  },
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '*/2 * * * * *': ['scraping:process'],
    },
    serverAssets: [{
      baseName: 'campaign',
      dir: fileURLToPath(new URL('./server/lib/campaign/assets', import.meta.url)),
    }],
    hooks: {
      // Copy Drizzle migrations into the build output. The startup migration
      // plugin (server/plugins/00.migrations.ts) reads them from `.output/migrations`
      // in production; without this copy it crashes on boot with ENOENT.
      async compiled(nitro) {
        await cp(
          fileURLToPath(new URL('./server/lib/database/migrations', import.meta.url)),
          join(nitro.options.output.dir, 'migrations'),
          { recursive: true },
        )
      },
    },
  },
  compatibilityDate: '2025-07-15',
  vite: {
    server: {
      // Allow the Nuxt/Vite dev server to be reached through ngrok tunnels.
      // A leading dot matches every subdomain, so rotating ngrok URLs keep working.
      allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
    },
  },
  eslint: {
    config: {
      standalone: false,
    },
  },
  imports: {
    dirs: ['composables/queries/*.{ts,js,mjs,mts}'],
  },
  nuxtEmailRenderer: {
    emailsDir: 'server/lib/mailer/templates',
  },
})

function stripNuxtPrefix(key: Record<string, unknown>) {
  // remove NUXT_ or NUXT_PUBLIC_ prefix
  return Object.fromEntries(
    // eslint-disable-next-line e18e/prefer-static-regex
    Object.entries(key).map(([k, v]) => [k.replace(/^NUXT(_PUBLIC)?_/, ''), v]),
  )
}
