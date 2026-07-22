import process from 'node:process'
import dotenv from 'dotenv'
import { defineConfig } from 'drizzle-kit'

dotenv.config({ path: '../../../.env' })

export default defineConfig({
  out: './migrations',
  schema: './schema',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL!,
  },
  strict: true,
  casing: 'snake_case',
})
